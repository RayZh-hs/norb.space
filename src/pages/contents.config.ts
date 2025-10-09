import mangoLogo from '../assets/projects/mango-logo.png';
import mkdataLogo from '../assets/projects/mkdata-logo.png';
import neutronicLogo from '../assets/projects/neutronic-logo-alt.png';

export const author = 'Norb'

export const description = 'A student developer advancing technology, leading creative projects, and occasionally building computers in Minecraft.'

export const longDescription = "I'm a passionate full-stack developer and student at SJTU, constantly diving into new technologies. I thrive on learning, and is fluent in cpp, Python and JavaScript. I am creative and enjoy building projects."

export const hobbies = [
    {
        icon: '🎨',
        title: 'Amateur CG Artist',
        description: 'Exploring 3D modeling and rendering. Love the freedom of storytelling through visual art.',
        link: '/gallery', // Optional: Link to a portfolio page
        linkText: 'View Portfolio'
    },
    {
        icon: '🎮',
        title: 'Indie Game Developer',
        description: 'Keen on designing and developing puzzle games. Prepare to bend your mind!',
        link: '/about', // Optional: Link to project detail
        linkText: 'Play Neutronic'
    },
    {
        icon: '🧱',
        title: 'Minecraft Modder & Redstoner',
        description: 'Keen on crafting digital Redstone circuits and developing mods. Pushing the boundaries of block-based creativity.',
        link: 'https://github.com/RayZh-hs/SJMCL', // Optional: Link to relevant repo/page
        linkText: 'Explore Mods'
    }
]

export const projects = [
    {
        title: 'Mango',
        description: 'A lightweight script management system for everyday tasks.',
        imageUrl: mangoLogo.src,
        imageIsLogo: true,
        link: 'https://github.com/RayZh-hs/Mango'
    },
    {
        title: 'MkData',
        description: 'Simple but powerful batch data generator based on Python.',
        imageUrl: mkdataLogo.src,
        imageIsLogo: true,
        link: 'https://github.com/RayZh-hs/mkdata'
    },
    {
        title: 'Neutronic',
        description: 'Red + Blue = None!',
        imageUrl: neutronicLogo.src,
        imageIsLogo: true,
        link: 'https://github.com/RayZh-hs/neutronic'
    }
]

export const emailAddress = 'ray_zh@sjtu.edu.cn'
export const socials = [
    { name: 'Email', url: 'mailto:' + emailAddress, icon: 'carbon:email' },
    { name: 'Github', url: 'https://github.com/RayZh-hs', icon: 'carbon:logo-github' },
    { name: 'WeChat', url: 'https://u.wechat.com/MOTpBKnK_SnffegtAi6mILY', icon: 'carbon:logo-wechat' },
]