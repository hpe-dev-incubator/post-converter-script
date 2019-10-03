import fetch from 'isomorphic-fetch';
import fs from 'fs';
import path from 'path';

const apiUrl = 'https://developer.hpe.com/dashboard/api';

const getAllBlogPosts = () =>
  fetch(`${apiUrl}/posts?type=blog&page=1&count=1000`)
    .then(res => res.json())
    .then(data => data);

const getBlogPost = async slug =>
  fetch(`${apiUrl}/post/title/${slug} `)
    .then(res => res.json())
    .then(data => data);

const createMdFromSlug = async slug => {
  const postData = await getBlogPost(slug);
  let tagsString = '[';
  // Use ternary for empty string conditionals in template literal otherwise
  // false will print to the string.
  postData.tags.forEach(
    (tag, index) =>
      (tagsString = `${tagsString}${index > 0 ? ',' : ''}"${tag}"${
        index === postData.tags.length - 1 ? ']' : ''
      }`),
  );
  // Convert the post to a markdown string
  let mdString = `---
title: ${postData.title}
date: ${postData.date}
author: ${postData.author || 'HPE DEV staff'} 
tags: ${postData.tags.length ? tagsString : '[]'}
path: ${slug}
---
`;

  for (let i = 0; postData.updatedSections.length > i; i += 1) {
    const section = postData.updatedSections[i];
    for (let j = 0; section.contentBlocks.length > j; j += 1) {
      const currBlock = section.contentBlocks[j];
      if (currBlock.blockType === 'BlockParagraph') {
        mdString = `${mdString}${currBlock.content}`;
      }
      if (currBlock.blockType === 'BlockImage') {
        const alt =
          currBlock.alt ||
          currBlock.image.title ||
          currBlock.content ||
          'blog image';
        mdString = `${mdString}![${alt}](${currBlock.image.path})\n`;
      }
    }
  }

  // Name and create the file
  const postDate = new Date(postData.date).toISOString().slice(0, 10);
  const filename = `${postDate}-${postData.slug.substring(0, 256)}.md`;
  const filePath = path.join('content', filename);
  fs.writeFile(filePath, mdString, err => {
    if (err) throw err;
    console.log(`${filename} has been created successfully.`); // eslint-disable-line no-console
  });
};

getAllBlogPosts().then(({ posts }) => {
  for (let i = 0; posts.length > i; i += 1) {
    createMdFromSlug(posts[i].slug);
  }
});
