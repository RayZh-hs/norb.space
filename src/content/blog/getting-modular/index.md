---
title: Getting Modular
publishDate: 2025-10-30
description: 'Design notes on mango submodules.'
tags:
  - CLI Tools
  - Technology
heroImage: { src: './thumbnail.png', color: '#eb9aa1ff' }
language: 'English'
---

https://github.com/Mango-CLI/Mango

## TL;DR

Mango has got submodule support at last. Update, and enjoy.

---

## What This Blog is About

If you are seeking information about the recent submodule update, or wish to learn how to use it, you can utilize the new builtin `mango @help` command to look up detailed information about all commands.

If you wish to develop your own templates and submodules, you will find documentation in the README.md file, and a multitude of demo templates in the [builtins repo](https://github.com/Mango-CLI/builtins.mango) should serve as a great starting point. A detailed online documentation entailing all mango features is planned, as will be released soon.

So why am I writing this blog?

The simple answer is, I wish to document the process I went through designing submodules and templates for Mango. **Each step of design, each choice taken or reverted bear careful analysis and reasoning.**

So this blog is not going to be a detailed tour on how to use submodules. Instead, it will guide you through a journey behind and beyond the mango submodule system you see now. If you want to dive deeper, and truly understand modularity in mango, you have come to the right place. If it so happens that you want to introduce modularity or reusability to one of your brilliant projects, you may also find some inspiration here.

So sit back, and let's begin.

## Craving Modularity

For me, one common use case of Mango is managing my schoolwork. Most of the time we rely on the famous Canvas Infrastructure, and I found myself repeatedly downloading assignments, doing them locally, and uploading them back. Mango helps me automate this process.

The problem is, different courses have different requirements, and I had to write the same canvas-handling code over and over again, which is tedious and annoying. I wished for a method to reuse the code across different mango repos.

Another point that I came across is that, in the old mango system, there is no good way to update the mango builtin commands. Users are free to roam the home repo and modify any file. In fact, they are encouraged to tailor their home mango to fit their own needs. Yet, this freedom comes at a cost: there is no way to systematically update the home repo, as rebooting the home repo will remove all user-defined scripts within.

Mango prides itself on being an extremely lightweight yet flexible script manager, yet the simplicity of the old mango system has placed a limit on its extensibility. **A simple, tiled script layout is easy to understand, but hard to extend.** There was in truth no good way to manage dependencies between scripts, or to publish reusable code.

## A Vague Idea

So I started by asking myself:

> What does modularity mean to Mango? What should it look like?

The first question is easy to answer: I want to incorporate a selection of "reusable code" from other repos, or other creators, into my own mango repo. This reusable code is either a dependency for my own code, or a set of commands that I want to use directly in this context. Unlike my own commands, such a segment should instead be **externally maintained, and easily updatable**.

The second question is trickier. There were lots of possible designs. What should submodules be? Should they be a a script that enacts a side effect on the mango repo? Or a archive that follows some given convention designed to provide functionality to the repo? How can the user access this reusable codebase? How should submodules be managed and updated?

There is no end to the questions to be answered, so I started out by investigating existing modularity systems.

- Git Submodules: Git allows users to include other git repos as subdirectories of their own repo. They can "clone" others' repos directly into their own, facilitating code reuse. There is no "central hub" for git submodules, and users manage submodules per project. Git keeps track of submodules and their versions in a special `.gitmodules` file.
- Linux Package Managers: Most linux systems ship with package managers, which provide a unified method to extend the os with third party software. Packages are served from central repositories, and are locally bookmarked strictly by name and version. They are installed in autonomous directories, and exposed to the user via binaries in the system PATH.
- Vim Extensions: Vim has a rich ecosystem of extensions, and numerous famous extension managers. Extensions are usually placed in a special directory. Their functionality comes from following directory structures.
- Python packages: Python also uses naming conventions and directory structures to define packages. They can be installed from central repositories, or can be user-defined.

So the problem boils down to several key design choices:

> 1. Is there a central repository for submodules, or is it decentralized?
> 2. What format should a submodule take?
> 3. Where should submodules be installed? In a central directory, or scattered project-wise? If the latter is true, how can we keep track of them?

The first question is simple. The topmost merit of having a central repository is security. However, it places a great limit on the freedom of publishers. Mango, as a user-driven script management tool, should make it easy for users to create and share content. **Users should decide what they trust and what to use in their own mango repos.** Therefore, I decided to go with a decentralized design. (Besides, I do not have the resources to maintain a central repository.)

The second question I found inspiration from git. Any git repo can be a submodule, which creates an isomorphism between git submodules and git repos. This is great design, as it allows for greater flexibility, as well as minimal workload for the developer to translate existing repos into submodules.

The last problem is indeed the trickiest. After much deliberation, I decided to go with a project-wise submodule system, since versioning may vary from project to project. Yet I found it pretty hard to decide on a single design. Here are some ideas put forward during the design process:

Regarding the construct of submodules:
1. The git repo itself is the `.mango` folder renamed. It contains `.instructions` and all other files.
2. The git repo wraps around the `.mango` folder, so `.git` and `.mango` are parallel directories. This enables users to place other files outside the mango implementation, like a README.md and a license file.

Regarding where to place submodules and how to track them:
1. Submodules are scattered across the repo like that in git. A special file (e.g. `.submodules`) that lists the relative directory of each submodule, relative to the .mango folder.
2. The submodule directories placed at top level, and keep a *.submodule format.
3. The submodule directories placed inside a special `.submodules` folder.
4. Submodules are not statically documented. Users use paths to invoke them, like using `mango path/to/submodule:command`. There is no way short of using brute force to list them though.

Primarily, I chose option 1 for construct, and option 3 for placement and tracking.

## The Price of a Flat Design

> A chance of isomorphism should never be missed in architecture design.

I chose these two because they yield a relatively flat file system, without unnecessary time overhead. Thus I reasoned to myself: Mango is designed to be simple, and by far all mango repos adhere to being a flat structure, making it simpler for users to understand, navigate and edit. Unlike git, where outside commands handle the `.mango` folder, users should be encouraged, if not required, to directly interact with the mango folder. It is for this reason that I placed great emphasis on keeping directory hierarchies flat and understandable.

However, just when I was about to finish implementing the submodule system, I realized some issues with this design.

First and foremost, this design makes it hard to build submodules. When working inside a directory that *would be* cloned into as a submodule, the original mango method of searching up the directory tree for `.mango` folders would fail to capture the repo, thus disabling users from utilizing `mango` to test their work. This can be mitigated by checking not only `.mango` directories but also `.instructions` files in the mango cli tool, but it seems rather unintuitive and dirty.

Worse still, there is no reliable and programmatic way to call submodules from submodules, due to the unavailability of the `mango` command inside submodule directories. This is a serious limitation, as it prevents users from building more complex submodule systems.

The problems, in essence, arises from an asymmetry between `.mango` folders and submodule ones. The former is recognized by the name, the latter by a position. The lack of isomorphism here created unintended complexities when it comes to development and deployment.

When designing systems, one should seek consistency and isomorphism wherever possible. This is a lesson learned the hard way. **A chance of isomorphism should never be missed in architecture design.**

## A Better Design

After much deliberation, I chose to adopt a better, more consistent design, at the price of more deeply nested directories. We will come to this design choice later.

```
~/.mango
├── .instructions
├── .submodules
│   └── builtins
|       ├── .mango
|       |   ├── .templates.registry
|       |   |   └── (template folders)
│       |   ├── .instructions
│       |   ├── .on-add
│       |   ├── .on-add.literal
|       |   ├── .on-install
│       |   └── (builtin mango commands)
|       └── (license and readme files)
├── .templates.registry
|   └── (user defined template folders)
├── .submodules.registry
|   └── (user defined submodules)
└── (user defined mango scripts)
```

In this design, each submodule **is** a repo, and the `.mango` directory resides inside the submodule folder, alongside other files like README.md and LICENSE. This generates a powerful isomorphism that any mango repo is a valid submodule, and any submodule is a valid mango repo. This greatly simplifies development and testing for submodules, and developers can now use `mango` commands directly inside submodule directories to access their submodules.

When submodules are installed, they are git cloned into the special `.submodules` folder, and a `.on-install` hook is called to perform any additional setup. This design keeps submodules organized and lightweight. Henceforth, submodules are updated using git pull, and removed by simply deleting their folders, no side effects.

Besides flexibility, another reason I deemed the design a fair tradeoff is that creators should be **discouraged** from directly editing and referencing submodule files. Come to think of it, submodules are supposed to expose API endpoints for users to call, not files to edit. By nesting them deeper in the directory tree, we can place a deliberate syntax barrier between users and submodule files, encouraging them to use `mango` commands as an intermediate layer to access submodules' functionality. This effect, while not intended at first, is indeed beneficial to the overall user experience.

## What About Templates?

So far we have all been talking about submodules, but what about templates?

The answer is simple: In mango, templates are simply just submodules. They follow the same rule, and the only difference is that, typically, the `.on-add` hook is defined to **replace the host repo's .mango directory with the one inside the template**. That's it!

In order for developers to build submodules and templates more easily, I included two builtin templates: the *submodule* template and the *template* template. Users can use them with `mango @init` to quickly scaffold their own submodule or template repos.

After they have finished developing their submodules or templates, they can either choose to publish them on git hosting services like github, or store them locally. Two registries are maintained in the host mango repo: `.submodules.registry` and `.templates.registry`. They act as local git remotes for users, including bare clones of the submodule/template repos, and will be searched when users invoke submodules and templates.

## Conclusion

We're done! After a month of design and development, mango submodules are finally here. We can now use templates and submodules both online and locally, and reuse code across different mango repos. We have setup a consistent and powerful modularity system that adheres to mango's core philosophy of simplicity and flexibility.

Since its first release, mango has come a long way. This submodule system is yet another milestone in mango's journey towards being a creatively-designed script management tool. I hope you would enjoy using it. Best regards, Norb, head of [Mango-CLI](https://github.com/Mango-CLI).
