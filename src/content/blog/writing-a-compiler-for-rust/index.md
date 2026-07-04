---
title: Writing a Compiler for Rust
publishDate: 2026-04-21
description: 'Thoughts on writing Rusty, a compiler for Rx.'
tags:
  - Compilers
heroImage: { src: './thumbnail.jpg', color: '#d68335' }
language: 'English'
---

[Rusty](https://github.com/RayZh-hs/rusty)

This semester, one coursework of mine required me to write a compiler for a subset of Rust named Rx. I chose Kotlin for this project, mostly to get familiar with the language, and partly because its sealed classes fit compiler data structures rather nicely. I named the compiler Rusty.

I spent a lot of time on this project, and I learnt much more from it than I expected. In this post, I will not go through how to make your own compiler step by step. Instead, I want to write down some of the design decisions and tradeoffs I faced when writing Rusty, especially the parts where a modern language-like frontend forced me away from the cleaner textbook story.

## A Standard Compiler Pipeline

A typical compiler pipeline consists of these stages:

1. **Preprocessing**: Removes macros and sometimes comments.
2. **Lexical Analysis**: Converts source code into a token stream.
3. **Parsing**: Converts the token stream into an Abstract Syntax Tree (AST).
4. **Semantic Analysis**: Checks the AST for semantic errors.
5. **IR Generation**: Converts the AST into an Intermediate Representation (IR).
6. **Optimization**: Optimizes the IR for better performance.
7. **Code Generation**: Converts IR into target machine code or assembly.
8. **Linking**: Combines multiple object files into a single executable.

For me, linking was not a major problem since Rx only supports single-file compilation. I also did not need to implement Rust macros, lifetimes, or the full trait system. The required middle-end target was LLVM IR, although in my humble opinion, LLVM IR without sufficient attributes is sometimes too permissive to express the guarantees that a strict language like Rust gives you.

Rusty eventually became a fairly standard pipeline:

```text
source -> preprocess -> lex -> parse -> semantic -> LLVM-like IR -> optimize -> RISC-V assembly
```

## Tricks for the Lexer

Textbooks often suggest using a list of regular expressions to recognize the next token. This is powerful, but it also hides a surprising amount of cost. Badly worded regex expresses easily throws the lexer into exponential time complexity. Many times, we can develop more targeted and faster methods by looking at the actual language grammar.

After reading the Rx syntax, I found a simple rule: the type of the next token can usually be determined by looking at the first character, with only a few extra checks.

- An **identifier or keyword** starts with an alphabetic character or `_`.
- A **number** starts with a digit. It can contain digits, underscores, and suffixes like `1_024i32`.
- A **normal string literal** starts with `"`, while byte strings and C strings start with prefixes such as `b"` and `c"`.
- A **raw string literal** starts with patterns like `r"`, `r#"`, `br"`, or `cr"`.
- A **character literal** starts with `'`, and byte character literals start with `b'`.
- Symbols and operators can be tokenized greedily, because the ambiguous operators in Rx are short and bounded.

So the Rusty lexer first classifies the next token with a small `peekClass` function. After that, each class has a specialized scanner. Identifiers and numbers scan until a word boundary. Escaped strings skip escaped characters. Raw strings count the number of `#` symbols and search for the matching closing delimiter. Operators try the longest known spelling first.

I do not infer that every language should have a hand-written lexer. The important lesson is that a unified mechanism is not automatically better. For a language subset with clear lexical boundaries, a targeted lexer can stay simple and run in low-constant $O(n)$ time. In practice, this made lexing cheap enough that it never became the bottleneck of Rusty, unlike the works of many other students in the course.

## Parsing Without Being Clever

The parser is a recursive descent parser built around the AST node hierarchy. Kotlin sealed classes worked well here: most AST families can be represented as closed sets of node variants, and later visitors can use `when` expressions to make missing cases visible.

There is an old temptation to make parsing "smart" by attaching too much meaning to it. I tried to avoid that. The parser's job in Rusty is to construct the syntax tree and reject syntactically invalid programs. It does not decide whether an identifier is a variable, a function, a type, or an associated item. It does not decide whether an integer literal should be `i32` or `usize`. It does not decide whether `self.foo()` is valid. Those questions are semantic questions, and mixing them into parsing would have made later passes harder to reason about.

This separation paid off when the language subset changed during the project. Some syntactic forms, such as tuples and match expressions, could still be parsed or represented, while semantic analysis became the place that rejected removed features with useful errors. In a course project, where the spec can evolve, that flexibility is very valuable.

## Semantic Analysis for Modern Languages

Before Rx, the course traditionally used a compiler for Mx, a subset of C. In Mx, semantic analysis is relatively straightforward. Many checks can be done in a single pass because declarations mostly obey a C-like order and the language has fewer context-sensitive rules.

Rx is different. Constants can be used before their textual definition. Functions can appear out of order. Functions can nest inside other functions. Blocks, loops, `if` expressions, `break`, and `return` all participate in type inference. Variables can shadow other variables. Mutability matters, especially when references, fields, and indexing are involved. This makes semantic analysis much more complicated and, in my experience, much more interesting.

I eventually settled on a five-pass semantic pipeline:

### Pass 1: Collect Item Names

The first pass builds the scope tree and records top-level item names. At this point, many symbols are only shells. A struct symbol knows that a struct exists and has certain field names, but the field types may still be unresolved. A function symbol knows that a function exists and has a signature slot, but some parameter and return types may not be filled in yet.

This pass also creates child scopes for crates, function parameter lists, function bodies, blocks, traits, `impl` blocks, and loops. That sounds like housekeeping, but it is one of the most important design choices in Rusty. Once scopes are explicit, every later pass can walk the same tree and ask a clear question: "What does this identifier mean from here?"

### Pass 2: Inject `impl` Items

Rust syntax lets you write methods away from the type definition:

```rust
struct Point {
    x: i32,
    y: i32,
}

impl Point {
    fn norm2(self) -> i32 {
        self.x * self.x + self.y * self.y
    }
}
```

For later phases, it is much more convenient if `Point` directly knows its associated methods. Rusty therefore performs an `impl` injection pass: it finds the target type of each `impl` block and injects the functions and constants from the impl scope into the corresponding struct or enum symbol.

Trait impls add another layer. Rusty checks that implemented functions and constants match the trait header-level requirements: no extra names, no missing names, matching method receiver kind, and matching arity. This is still far from a complete Rust trait solver, but it is enough to make the subset coherent and to keep method lookup from degenerating into ad hoc searches later.

### Pass 3: Resolve Item Types

After names and associated items are available, Rusty resolves item-level types. Struct fields get concrete semantic types. Function parameter and return types are resolved. Constants get their declared types and can be evaluated through the static resolver. The `main` function receives a special return treatment because the language and judge expectations treat it more like an exit point than an ordinary value-returning function.

The key tradeoff here is patience. It is tempting to resolve expression bodies as soon as you see a function, but doing so too early creates problems for out-of-order definitions. By resolving item headers first, Rusty makes all callable and nameable things visible before checking executable code.

### Pass 4: Declare Function Parameters

Function parameters are not just strings in a signature. They are variables inside the function body scope. This is especially important for destructuring patterns and for `self`.

Rusty has a dedicated pass that enters each function's definition scope and declares parameter symbols there. If a method has a receiver, the pass creates a variable symbol named `self` with the correct type and mutability. For ordinary parameters, it extracts variables from typed patterns and declares them in order.

Separating this from item type resolution may look verbose, but it keeps the model clean. A function signature belongs to the containing scope; its parameter variables belong to the function's inner scope. Treating those as different facts avoids many small bugs in lookup and shadowing.

### Pass 5: Trace Function Bodies

The final semantic pass walks executable code. This is where most of the "Rust-like" complexity appears.

Rusty resolves every expression type and remembers the result in a type memory attached to the AST. It checks implicit and explicit casts, binary and unary operators, integer literal bounds, field access, method calls, indexing, reference and dereference expressions, struct literals, assignment targets, `return`, `break`, `continue`, and block result types.

Some examples of the checks in this pass:

- Assignment requires a valid left-value. Assigning to an immutable binding is rejected.
- Assigning through a reference requires a mutable reference.
- Indexing auto-dereferences references to arrays, but still respects mutability when used as an assignment target.
- `if` branches must infer a compatible common type.
- `loop` and `while` bodies use `break` expressions to infer the loop's result type.
- `return` expressions contribute to the expected function return type.
- Integer literals are progressively constrained by their surrounding context.
- Code after a known `exit()` is rejected as unreachable.

This pass is long, and I do not think that is automatically a bad thing. A semantic checker is the part of a compiler where the language's actual rules collect. The danger is not length by itself; the danger is mixing unrelated responsibilities. Rusty's function tracing pass is large, but its responsibility is still one thing: simulate the meaning of executable code well enough to assign types and reject invalid programs.

## Afterthoughts: On AST Tree Walking

In the prior two phases Rusty depended heavily on tree walking, the textbook way to traverse an AST. In hindsight, I think this may not be a good fit after all. In many cases we need not walk the entire tree, but only need to visit a small selection of AST node types. Another issue arises with state management. Here's an example: Most traversals require block awareness - knowing which block we are presently inside, and a list up to the prelude block. In traditional tree walking, we would need to reconstruct this data each time anew, and we cannot easily share the code between passes. I settled with a dirty way of:

- Creating auxiliary data structures to store the state of the current traversal, for instance `ScopeMaintainerCompanion` which maintains the current scope, and `SelfResolverCompanion` which resolves the `self` syntax to the correct type.
- Wiring them up into `SimpleVisitorBase` to create mixed versions of visitor bases, like `ScopeAwareVisitorBase`.

Since, unlike Python with its almighty decorators, and Rust with its magical macros, Kotlin does not have a good way to mix these behaviors in, so I ended up with an overwhelming number of visitor base classes, each containing boilerplate code, because I dislike using mixins.

Today, were I to redesign this section I would have used a context store. Instead of traversing the entire tree time and again, I would have stored all the data needed in a context object, forming a sparse tree that mirrors the AST. I would be able to provide jump-points from which I can freely index the tree, filtering out what I need, and mutating the context like what `self` is in scope, etc. This would have made the code much cleaner, and would have allowed me to boost the speed of the semantic analysis phase greatly by cutting down on deep function calls and repeated calculations.

## Afterthoughts: A Small Type System Is Still a Type System

Another afterthought when implementing Rx's semantic analysis is that "subset" does not mean "simple". Even a simplified Rust needs a real semantic model to handle type inference and constant analysis.

Take an example: we can assign literal `100` to both `i32` and `u32`, but we cannot assign `-100` to `u32`. We cannot assign `I32MAX + 1` to `i32`, but we can assign its negative `-I32MAX - 1` to `i32`. There are literals that can be interpreted as multiple types, and, strongly typed as Rx is, there are still hidden "implicit casts" that cast a literal to one concrete type. Couple this with tuples and structs, and the type system becomes a non-trivial part of the compiler.

Rusty's semantic layer distinguishes types, symbols, and values:

```text
SemanticType   -> what shape a thing has
SemanticSymbol -> what name was declared and where
SemanticValue  -> what constant value is known
```

That separation saved me from several design traps. A struct type is not the same as the symbol that declared the struct. A constant symbol is not the same as the value it evaluates to. A variable's type is not the same as the loaded value that will later appear in IR.

This matters because the compiler often needs only one of the three. During field lookup, we mostly care about the type. During shadowing checks, we care about the symbol and its scope. During array repeat expressions, we need an actual constant value. Keeping those concepts separate makes the code a little more verbose, but much less confusing.

## Generating IR

Rusty uses a vendored [Kotlin LLVM-like IR library](https://github.com/RayZh-hs/LLVM), which I wrote as well. It is strange that the only Kotlin-native LLVM library is old and does not support modern LLVM features. The IR constructor performs several ordered steps:

1. Register the prelude and runtime-facing functions.
2. Register struct layouts.
3. Generate helper functions for struct sizes where needed.
4. Register function signatures before generating bodies.
5. Generate function bodies.

The "register first, generate later" idea is important for the same reason as semantic item collection: functions can call functions that are defined later in the source file.

The IR generator also has to decide how source-language values map to IR values. Unit-derived types produce no storage. Strings become private global arrays with a pointer to their first byte. Struct and array values often travel by pointer because aggregate copying in LLVM IR must be handled carefully. Large aggregate assignments are lowered with explicit memory copies instead of pretending every value is a small scalar.

A trick worth documenting here: Since I wanted to test my IR code on my x86 machine, I could not hardcode the size of structs into the generated LLVM IR. Instead, I generated a helper function for each struct that returns its size. It creates a 2-array of that type, and returns the offset of the second element from the first, using pointer arithmetic. This is a good debugging strategy (of course, it is optimized way in later phases).

## Optimization: To Save the Day

Arguably, optimization is the hardest and most important part of a compiler. It took me around a month to implement the entire, production-ready optimization pipeline for Rusty.

Optimizations mainly take the form of IR transformations. Rusty performs 20 IR transformation passes in sequence:

1. SizeInliningPass
2. FunctionInliningPass (threshold 40)
3. SmallMemcopyLoweringPass
4. InstCombineCleanupPass
5. PointerSlotForwardingPass
6. ScalarReplacementOfAggregatesPass
7. Mem2RegPass
8. AggressiveDeadCodeEliminationPass
9. InstCombineCleanupPass
10. IdenticalGepReductionPass
11. GlobalValueNumberingPass
12. InstCombineCleanupPass
13. LoopInvariantCodeMotionPass
14. LoopAddressReductionPass
15. InstCombineCleanupPass
16. LoopCounterPromotionPass
17. InstCombineCleanupPass
18. CFGSimplifyPass
19. AggressiveDeadCodeEliminationPass
20. InstCombineCleanupPass

I will not go into the details of each pass, but I will pick two that I think worth special mention.

### SmallMemcopyLoweringPass

```llvm
; before  (copy 8 bytes, repeat count 1)
call void @aux.func.memfill(ptr %dst, ptr %src, i32 8, i32 1)

; after
%c.load = load i64, ptr %src   ; "lowered small memcpy"
store i64 %c.load, ptr %dst    ; "lowered small memcpy"
```

The idea is, for fixed-size structs who can fit into a single register, we can lower the `memcpy` call into a load and store instruction which, hopefully later can be turned into a register move by Mem2Reg. We "reinterpret" the memory as a single integer type, and load/store it in one go. This is a very efficient way to handle small struct copies, and due to its numerous nature, it helps quite a lot.

### Mem2Reg Pass

```llvm
; before
%x = alloca i32
store i32 0, ptr %x
br ... ; then store i32 1 on one path
%v = load i32, ptr %x

; after
%x.phi = phi i32 [ 0, %entry ], [ 1, %then ]
; %v replaced by %x.phi; alloca/loads/stores removed
```

This is definitely the most important optimization pass in Rusty. It is a classic SSA construction pass, which promotes stack-allocated values to registers. The final production-ready version relies on escape analysis.

The nice thing about writing a rust-like language is that we can make a lot of assumptions about the LLVM IR we generate. In practice, most of the escape analysis is trivially done in the IR generator, and passed down in the form of attributes. This saved me a lot of time: Recovering this from LLVM IR is non-trivial.

### A failed attempt: Jump Lowering

```llvm
; before
block1:
    %cond1 = icmp eq i32 %x, 0
    br i1 %cond1, label %block2, label %block4
block2:
    %cond2 = icmp eq i32 %y, 0
    br i1 %cond2, label %block3, label %block4

;after:
block12:
    %cond1 = icmp eq i32 %x, 0
    %cond2 = icmp eq i32 %y, 0
    %cond12 = and i1 %cond1, %cond2
    br i1 %cond12, label %block3, label %block4
```

Here I mention an attempt that ended up making the compiler slower. Last year, when taking the CPU course, I learnt that speculative execution is a must for modern processors, and that branch misprediction is a major performance killer. Therefore, I thought, if I could merge blocks and replace multiple branches with a single branch, with precalculated and merged conditions, I can cut down on the number of branches and improve performance.

However, in practice, this optimization was not effective. In my view there are two possible explanations:

1. Modern branch predictions are very good, and they seldom fail.
2. This modification disabled the Branch Preset Optimization in Assembly Generation, which we will cover later, disrupting the performance of the generated assembly greatly.

Nevertheless, this is a very interesting finding, and I present it to you as a cautionary tale: Not all optimizations that seem reasonable are actually effective.

## Lowering to RISC-V

The last stage of Rusty lowers IR into RISC-V assembly. The main target configuration is RV64 with integer and multiply/divide instructions, while the judge runtime path uses Clang to build compatible `rv64gc/lp64d` runtime assembly.

The backend is split into three main pieces:

- A register allocator.
- A stack frame materializer.
- An instruction translator.

The register allocator uses liveness and use-def information to build an interference graph. Values that are too large for a register are forced onto the stack. Smaller values are colored into physical caller-saved and callee-saved registers, with deterministic tie-breaking so that output remains stable for debugging.

The inference graph, if unpruned, is $O(n^2)$ in size. This leads to severe performance problems for large functions. We can think of this issue as a scheduling problem: if there are more than $k$ live values at a program point, and only $k$ registers, then some values must be spilled. When building the graph, we can draw on a heuristic to spill, for instance, the most-distantly used value (yes, we are doing optimizations offline, so we know the future). This allows us to prune the graph to $O(kn)$ size, and total complexity is $O(k^2 + kn)$. A great improvement!

After allocation, the stack frame materializer assigns concrete stack objects for spills, allocas, saved callee-saved registers, return addresses, call temporaries, and outgoing stack arguments. Only after this step does the translator know enough to emit correct prologues, epilogues, loads, stores, and call sequences.

Finally, the translator lowers each IR instruction into RISC-V assembly. Small values can be moved through registers. Aggregate values are copied through memory. `getelementptr` becomes address arithmetic based on computed type layouts, and small structs, those within 64 bits, are loaded directly. Phi nodes are handled as edge moves before branch targets. Function calls preserve the required registers and pass arguments through `a0` to `a7` or the stack.

Many optimizations done in the Assembly Generation phase are due to the flexible nature of the RISC-V instruction set. A very telling example is the lowering of conditional jumps, which terminate most loops. I noticed, by comparison with the GCC-generated assembly, that in many cases,

```
%case = icmp eq i32 %x, 0
br i1 %case, label %then, label %else
```

Need not be lowered to a register comparison and a conditional branch. Instead, it can be lowered to a single `beqz` instruction, which is shorter and, it turns out, much faster. Indeed, this accounted for 10% in optimization score in the judge's test cases.

## Closing Thoughts

Writing Rusty made me appreciate how much of compiler construction is about choosing the right boundaries. Lexing was fast because it used language-specific structure. Parsing stayed manageable because it did not try to solve semantic problems. Semantic analysis became understandable only after being split into multiple passes. The design of such a compiler is not about writing clever code, but about making the right tradeoffs and keeping the responsibilities of each component clear.

A lesson throughout this entire project is that, the textbook way is never the only way. The textbook way way may be universal, but each language has its special characteristics. A compiler for a modern language must be aware of those characteristics, and to take advantage of them, and here lies the real challenge and joy of compiler design.

It also made me aware that everyday tools like `rustc`, `clang` and `gcc` are so immensely powerful and complex. Despite nearly a year of work, Rusty still lags behind `gcc` O2 optimization in almost every task, let alone O3 and Ofast. A wise instructor of mine once said that "there is no magic in the world", and that applies to compiler design perfectly. The small, compact binary that we use daily to transform our high-level code into machine code is the result of decades of research, engineering, and optimization. It is a testament to the depth and breadth of knowledge required to build such tools.

The final compiler is still small compared with a real Rust compiler, but it is large enough to contain many of the same design pressures. That is what made the project worthwhile. A subset can remove features, but it cannot remove the need for coherent design.

If you are interested, the source code is available at [github.com/RayZh-hs/rusty](https://github.com/RayZh-hs/rusty). Head to the `target/oj-testing` branch to see the modified rv64im edition with full optimization suite.
