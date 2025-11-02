---
title: Introducing Mango
publishDate: 2025-8-30
description: 'A light-weight script management tool based on the file system.'
tags:
  - CLI Tools
  - Technology
heroImage: { src: './thumbnail.jpg', color: '#d8c37fff' }
language: 'English'
---

https://github.com/Mango-CLI/Mango

Script management has always been vital to productivity in software development. Almost every aspiring developer has in his or her toolkit an arsenal of scripts to automate repetitive tasks, streamline workflows, and boost their everyday work efficiency.

Yet a global `/usr/local/bin` directory is not the solution for scope-specific or project-specific scripts. Most builders (pnpm, gradle, uv, etc.) have their own way for allowing users to define and manage scripts within the context of their projects, leading to a kaleidoscope of approaches towards the same problem. Furthermore, global vs. project-specific is about as fine-grained as you can get for customizing user scripts.

## What Mango is About

And yes, here is where mango comes in: To fill in the gap of unified script management, and to provide a file-system based approach to organizing and running scripts.

Mango allows you to manage your scripts across projects, using folders as scopes to fine-tune your script organization. This offers flexibility beyond traditional hook-based ways adopted by package managers.

## Designing Mango

The core idea of Mango is incredibly simple. Every folder that contains a `.mango` folder is a mango repo. Whenever the user invokes:

```bash
mango command-name args
```

The mango executable searches up the directory tree for a `.mango` folder. If such a folder is found, it maps the command name to a script file registered in that mango repo registry. Appending an `@` symbol to the command name enables recursive search (mango will search up dir if no match is found in the first mango repo).

When the user installs mango, a `.mango` folder is created in the user's home directory, making that directory the user's **home mango**. Common utilities will be installed in the home mango, making them globally available via `mango @command-name`. So yes: Mango is managed by mango!

```bash
mango @init --template bash
```

This will make the current repo a mango repo because `init` is a command registered in the home mango, linking to a python script that sets up the folder and initializes the mango environment.

The same is true for **all mango commands**. They are nothing *magic*, just files in the home mango that you can play around or modify. This makes mango extremely extensible and customizable.

## Why Mango Matters

Mango is yet another script management system. It is nothing fancy, but it does address the need for a unified and extensible scripting solution, in a simple yet elegant way. It is designed to be easy to use, easy to extend, and easy to integrate into existing workflows. This is why personally, I deem Mango a welcoming addition to my workflow, and I have been using it ever since I finished the project.

If you are interested in the Mango project, feel free to check out the [GitHub repository](https://github.com/Mango-CLI/Mango). We welcome contributions, suggestions, and feedback from the community!

Happy scripting!
