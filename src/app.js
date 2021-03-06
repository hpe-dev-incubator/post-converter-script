import fetch from 'isomorphic-fetch';
import fs from 'fs';
import path from 'path';

const contentdir = './content';
const opensourcedir = './content/opensource';
const blogdir = './content/blogs';
const externalblogdir = './content/externalblogs';
const newsletterArchivedir = './content/newsletter-archive';
if (!fs.existsSync(contentdir)) {
  fs.mkdirSync(contentdir);
}
if (!fs.existsSync(opensourcedir)) {
  fs.mkdirSync(opensourcedir);
}
if (!fs.existsSync(blogdir)) {
  fs.mkdirSync(blogdir);
}
if (!fs.existsSync(externalblogdir)) {
  fs.mkdirSync(externalblogdir);
}
if (!fs.existsSync(newsletterArchivedir)) {
  fs.mkdirSync(newsletterArchivedir);
}

const apiUrl = 'https://developer.hpe.com/dashboard/api';

const getAllBlogPosts = () =>
  fetch(`${apiUrl}/posts?type=blog&page=1&count=1000`)
    .then(res => res.json())
    .then(data => data);

const getExternalBlogPosts = () =>
  fetch(`${apiUrl}/contributions?type=blog&page=1&count=1000`)
    .then(res => res.json())
    .then(data => data);

const getBlogPost = async slug =>
  fetch(`${apiUrl}/post/title/${slug} `)
    .then(res => res.json())
    .then(data => data);

const getExternalBlogPost = async hashId =>
  fetch(`${apiUrl}/contributions/blog/${hashId} `)
    .then(res => res.json())
    .then(data => data);

const getOpenSourceProjects = () =>
  fetch(`${apiUrl}/post/title/projects`)
    .then(res => res.json())
    .then(data => data);

const createMdFromSlug = async slug => {
  const postData = await getBlogPost(slug);
  // fetch blogs which are only released
  if (postData.status === 'release') {
    const contentSections = postData.updatedSections || postData.sections;
    // Colons in the title break frontmatter. Use quotes instead.
    const postTitle = JSON.stringify(postData.title);
    let tagsString = '[';
    // Use ternary for empty string conditionals in template literal otherwise
    // false will print to the string.
    postData.tags.forEach(
      (tag, index) =>
        (tagsString = `${tagsString}${index > 0 ? ',' : ''}"${tag}"${
          index === postData.tags.length - 1 ? ']' : ''
        }`),
    );
    // pick a random author image from the avathar list
    const avathars = [
      '/img/blogs/Avatar1.svg',
      '/img/blogs/Avatar2.svg',
      '/img/blogs/Avatar3.svg',
      '/img/blogs/Avatar4.svg',
      '/img/blogs/Avatar5.svg',
      '/img/blogs/Avatar6.svg',
    ];

    const random = Math.floor(Math.random() * avathars.length);
    const authorimage = JSON.stringify(avathars[random]);

    // Convert the post to a markdown string
    let mdString = `---
title: ${postTitle}
date: ${postData.date}
author: ${postData.author || 'HPE DEV staff'} 
tags: ${postData.tags.length ? tagsString : '[]'}
authorimage: ${authorimage}
featuredBlog: false
priority:
thumbnailimage:
---
`;

    for (let i = 0; contentSections.length > i; i += 1) {
      const section = contentSections[i];
      for (let j = 0; section.contentBlocks.length > j; j += 1) {
        const currBlock = section.contentBlocks[j];
        if (currBlock.blockType === 'BlockParagraph') {
          const mdParagraph = currBlock.content;
          const regex = /(```)/g;
          let matchCount = -1;
          let newMdParagraph = mdParagraph.replace(
            regex,
            (match, matchTwo, index) => {
              // console.log(match, matchTwo, index);
              // console.log(
              //   'prev',
              //   mdParagraph[index - 1],
              //   'index',
              //   mdParagraph[index],
              //   'after',
              //   mdParagraph[index + 1],
              // );
              matchCount += 1;
              if (matchCount % 2 === 0) {
                return '\n```';
              }

              return match;
            },
          );
          newMdParagraph = newMdParagraph.replace('<br/>', '');
          mdString = `${mdString}${newMdParagraph}`;
        }
        if (currBlock.blockType === 'BlockImage' && currBlock.image) {
          const alt =
            currBlock.alt ||
            currBlock.image.title ||
            currBlock.content ||
            'blog image';
          const isFirstBlock = i === 0 && j === 0;
          mdString = `${mdString}${
            !isFirstBlock ? '\n\n' : ''
          }![${alt}](https://hpe-developer-portal.s3.amazonaws.com${
            currBlock.image.path
          })\n\n`;
        }
      }
    }

    // Name and create the file
    const filename = `${postData.slug.substring(0, 256)}.md`;
    const filePath = path.join('content/blogs', filename);
    fs.writeFile(filePath, mdString, err => {
      if (err) throw err;
      console.log(`${filename} has been created successfully.`); // eslint-disable-line no-console
    });
  }
};

const createMdFromHashID = async hashId => {
  const postData = await getExternalBlogPost(hashId);
  // fetch blogs which are only released
  if (postData.status === 'PUBLISHED') {
    const content = postData.content.replace(
      /\(\/uploads\/media+/g,
      '(https://hpe-developer-portal.s3.amazonaws.com/uploads/media',
    );
    // Colons in the title break frontmatter. Use quotes instead.
    const postTitle = JSON.stringify(postData.title);
    const blogSlug = /[^/]*$/.exec(postData.slug)[0];
    // const blogpath = `${hashId}/${blogSlug}`;
    const authorName =
      postData.member.firstName + ' ' + postData.member.lastName;
    let tagsString = '[';
    // Use ternary for empty string conditionals in template literal otherwise
    // false will print to the string.
    postData.tags.forEach(
      (tag, index) =>
        (tagsString = `${tagsString}${index > 0 ? ',' : ''}"${tag}"${
          index === postData.tags.length - 1 ? ']' : ''
        }`),
    );
    // pick a random author image from the avathar list
    const avathars = [
      '/img/blogs/Avatar1.svg',
      '/img/blogs/Avatar2.svg',
      '/img/blogs/Avatar3.svg',
      '/img/blogs/Avatar4.svg',
      '/img/blogs/Avatar5.svg',
      '/img/blogs/Avatar6.svg',
    ];

    const random = Math.floor(Math.random() * avathars.length);
    const authorimage = JSON.stringify(avathars[random]);

    // Convert the post to a markdown string
    let mdString = `---
title: ${postTitle}
date: ${postData.createdAt}
author: ${authorName || 'HPE DEV staff'} 
tags: ${postData.tags.length ? tagsString : '[]'}
authorimage: ${authorimage}
featuredBlog: false
priority:
thumbnailimage:
---
`;

    mdString = `${mdString}${content}`;
    console.log('postTitle', postTitle);

    // Name and create the file
    const filename = `${blogSlug.substring(0, 256)}.md`;
    const filePath = path.join('content/externalblogs', filename);
    fs.writeFile(filePath, mdString, err => {
      if (err) throw err;
      console.log(`${filename} has been created successfully.`); // eslint-disable-line no-console
    });
  }
};

const createMdFromProjects = async projects => {
  const postData = projects;
  const contentSections = postData.updatedSections || postData.sections;

  for (let i = 0; contentSections.length > i; i += 1) {
    const section = contentSections[i];
    for (let j = 0; section.contentBlocks.length > j; j += 1) {
      const currBlock = section.contentBlocks[j];
      if (currBlock.blockType === 'BlockTileCard') {
        const projectTitle = JSON.stringify(currBlock.card.heading);
        const category = currBlock.card.label
          .replace(/\ /g, '')
          .split('-')
          .pop();
        // Convert the project to a markdown string
        let mdString = `---
          title: ${projectTitle}
          category: ${category}
          link: ${currBlock.card.linkUrl}
          description: ${currBlock.card.content}
          priority: ${j}
          image: '/img/opensource/spiffe.svg'
---
          `;
        // Name and create the file
        let heading = currBlock.card.heading.replace(/\ /g, '_');
        const filename = `${heading.substring(0, 256)}.md`;
        const filePath = path.join('content/opensource', filename);
        fs.writeFile(filePath, mdString, err => {
          if (err) throw err;
          console.log(`${filename} has been created successfully.`); // eslint-disable-line no-console
        });
      }
    }
  }
};

function monthDiff(dateFrom, dateTo) {
  return (
    dateTo.getMonth() -
    dateFrom.getMonth() +
    12 * (dateTo.getFullYear() - dateFrom.getFullYear()) +
    2
  );
}

const createMdFromNewsletterArchive = async slug => {
  const postData = await getBlogPost(slug);
  const contentSections = postData.updatedSections || postData.sections;
  const startDate = new Date(2018, 8);
  for (let i = 0; contentSections.length > i; i += 1) {
    const section = contentSections[i];
    for (let j = 0; section.contentBlocks.length > j; j += 1) {
      const currBlock = section.contentBlocks[j];
      if (currBlock.blockType === 'BlockTileCard') {
        const dateArr = currBlock.card.label.replace(/,/g, '').split(' ');
        const currentDate = new Date(currBlock.card.label);
        // Calculate newsletter number
        const months = monthDiff(startDate, currentDate);

        // Convert the project to a markdown string
        let mdString = `---
title: ${JSON.stringify(currBlock.card.heading)}
date: ${new Date(currBlock.card.label).toISOString()}
link: ${currBlock.card.links[0].url}
description: ${currBlock.card.content.replace(/\s/g, ' ')}
monthly: ${months}
---
            `;
        // Name and create the file
        const filename = `${dateArr[2]}-${dateArr[0]}-${dateArr[1]}.md`;
        const filePath = path.join('content/newsletter-archive', filename);
        fs.writeFile(filePath, mdString, err => {
          if (err) throw err;
          console.log(`${filename} has been created successfully.`); // eslint-disable-line no-console
        });
      }
    }
  }
};

getAllBlogPosts().then(({ posts }) => {
  for (let i = 0; posts.length > i; i += 1) {
    // for (let i = 0; i === 0; i += 1) {
    createMdFromSlug(posts[i].slug);
  }
});

getExternalBlogPosts().then(({ posts }) => {
  for (let i = 0; posts.length > i; i += 1) {
    // for (let i = 0; i === 0; i += 1) {
    createMdFromHashID(posts[i].hashId);
  }
});

getOpenSourceProjects().then(projects => {
  createMdFromProjects(projects);
});

createMdFromNewsletterArchive('newsletter-archive-feed');
