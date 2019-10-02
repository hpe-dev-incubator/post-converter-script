import fetch from 'isomorphic-fetch';
import fs from 'fs';

const getBlogPost = async slug =>
  fetch(`https://developer.hpe.com/dashboard/api/post/title/${slug} `)
    .then(res => res.json())
    .then(data => data);

const runScript = async () => {
  const postData = await getBlogPost(
    'hacktoberfest-2019-help-grommet-and-win-a-free-t-shirt-in-the-process',
  );

  // Convert the post to a markdown string
  let mdString = `---
title: ${postData.title}
date: ${postData.date}
author: ${postData.author || 'HPE DEV staff'} 
tags: ${postData.tags.length ? postData.tags : '[]'}
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

  fs.writeFile(filename, mdString, err => {
    if (err) throw err;
    console.log(`${filename} has been created successfully.`);
  });
};

runScript();
