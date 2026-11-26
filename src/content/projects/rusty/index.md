---
projectName: Rusty
description: 'A minimal Rx compiler written in Kotlin.'
category: 'Systems & Compilers'
year: '2026'
tags:
  - Compiler
  - Rust / Rx
  - Kotlin
icon: { src: './logo.png', scale: 0.8 }
gradient: { from: '#d64c1f', to: '#f6a545' }
blogpage: /blog/writing-a-compiler-for-rust
homepage: https://github.com/RayZh-hs/rusty
order: 5
---

Rusty is a from-scratch compiler for Rx — a strict, Rust-inspired subset language — written in Kotlin and targeting LLVM IR.

Covers lexical analysis, Pratt/recursive-descent parsing, semantic type & borrow-adjacent checks, and structured IR emission.
