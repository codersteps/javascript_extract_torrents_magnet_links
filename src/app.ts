import path from "path";
import fs from "fs/promises";
import * as cheerio from "cheerio";
import { curly } from "node-libcurl";
import liveServer from "live-server";

const config = {
  baseUrl: "https://1337x.to",
  selectors: {
    anchorLink:
      'table > tbody> tr > td:first-child > a:last-child[href^="/torrent/"]',
    magnetAnchorLink: 'ul>li>a[onclick="javascript: count(this);"]',
  },
};

async function get(path: string): Promise<string> {
  const result = await curly.get(`${config.baseUrl}${path}`);
  if (result.statusCode !== 200) {
    throw `error with status code: ${result.statusCode}`;
  }
  return result.data;
}

async function writePublicIndex(magnets: string[]) {
  const indexPath = path.resolve("./public/index.html");

  const html = ["<div>"];
  for (const magnet of magnets) {
    html.push(`
  <a href="${magnet}" target="_blank">Link</a>`);
  }
  html.push(`
  <script>
    window.onload = async (event) => {
      let executed = 1
      for (let anchor of Array.from(document.getElementsByTagName('a'))) {
        await new Promise((res, rej) => {
          setTimeout(() => {
            anchor.click()
            console.log('magnet executed: ', executed)
            res()
          }, 3000)
        })
        executed++
      }
    }
  </script>
</div>
  `);

  try {
    await fs.writeFile(indexPath, html.join(""), {
      encoding: "utf-8",
    });
  } catch (e: any) {
    console.log(`Error while writing the ${indexPath}: ${e.message}`);
  }
}

async function servePublicDir() {
  const params = {
    root: "public",
    open: false,
  };
  liveServer.start(params);
}

async function app(path: string) {
  try {
    const html = await get(path);
    const $ = cheerio.load(html);

    const anchors = Array.from($(config.selectors.anchorLink));
    const hrefs = anchors.map((a) => $(a).attr("href")) as string[];

    let fetched = 1;
    const magnets: string[] = [];
    for (const href of hrefs) {
      const html = await get(href);
      const $ = cheerio.load(html);

      const magnet = $(config.selectors.magnetAnchorLink).attr(
        "href"
      ) as string;
      magnets.push(magnet);

      console.log("magnet fetched: ", fetched);
      fetched++;
    }

    await writePublicIndex(magnets);
    servePublicDir();
  } catch (e: any) {
    console.error(e);
  }
}

const pagePath = process.argv.length >= 3 ? process.argv[2] : "/popular-music";
app(pagePath);
