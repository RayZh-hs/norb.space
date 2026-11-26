# Refactor Guide

Refactor the norb.space homepage to dramatically improve the user experience through smooth 3D visuals and a bold and coherent design. The homepage's theme is minimalistic and should follow the following designs:

## Overall Theme

- Minimalistic
- Clean and modern typography
- Clarity and simplicity for content presentation
- Black/White color scheme with subtle accent colors
- Artistic and creative

## Content Layout

The original homepage separates the homepage, blogs, projects and gallery. This leads to a disjointed user experience. The new interfaces resolves around these sections:

- Homepage: Landing site, introducing me and my pursues. Links to other sections.
- Blogs: Contains ideas on my academic and personal life. Each blog post can be linked to a specific project.
- Project: Showcases my work, be it creative and development projects. Category filters can be used to sort through the projects I conduct.

## Homepage

Loading screen is a minimalistic circle loading animation. The circle starts from the bottom and completes itself, forming an "o" that becomes the "o" in Norb.

Title screen is "Call me \n Norb" with a subtle 3D effect according to mouse motion. Mouse becomes a small inversion circle. Subtext: "An aspiring student developer working on LLM Agentic and Computer Vision".

Scrolling down, present an autobiography section. I would like to introduce myself in this way: Stay static a "I am a " on the screen and in each scroll, change to the next word in the list:

- "Student Developer": I major in Computer Science in SJTU ACM class, and I am passionate about software engineering. My github account is [RayZh-hs](https://github.com/RayZh-hs) and on it I have contributed to many open-source projects.
- "Frontier Researcher": I currently work on LLM Agentic and Computer Vision at Gair Lab, where I push the frontiers of AI research. You will find many blogs on this site that discuss my research and development work.
- "Creative Designer": I am an amateur CG artist, and have many years of experience in 3D modeling and set-dressing. It is the love of CG art that first led me to seek deeper in Computer Vision and Graphics research, and this passion has been the driving force behind my academic pursuits.
- "Photographer": I have a keen interest in photography, capturing moments and scenes during my travels. Some of these photos can be found in creative projects on this site.
- "Botanist": I have a deep love for plants and nature. I care for many plants and frequently go on excursions to explore the natural world.
- "(I am) Who I am": Like all of us, I am a complex individual with many facets. I continue to explore and grow and I am excited to share my journey with you through this website. (invert color)

I would like there to be a smooth scene morph between each section. It should be intriguing and visually appealing while always adhering to the minimalistic theme.

Finally, change to "I am Norb", and contact information.

## Blogs

The current blog layout itself can still apply, but you should redesign the blog list page to engage more and provide a more unique experience. Also enable jumping to host project.

Note that the dynamic nature of the front page should not be applied to the blog reading itself. Find a way to make blog reading engaging without the distractions of frontend while keeping the design consistent.

## Projects

Array projects in a helix. LHS zooms out and shows filtering options, while RHS expands the project and prompts users to see project introduction or related blogs, as well as showing possible links.
