import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';

async function diagnose() {
  try {
    const response = await axios.get('https://html.duckduckgo.com/html/?q=Saleswizard', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
      }
    });

    console.log("HTML response length:", response.data.length);
    fs.writeFileSync('ddg_response.html', response.data);
    
    const $ = cheerio.load(response.data);
    
    // Let's print some common selectors
    console.log("Number of '.result' elements:", $('.result').length);
    console.log("Number of '.web-result' elements:", $('.web-result').length);
    console.log("Number of 'a' elements:", $('a').length);
    
    // Let's inspect class names of divs
    const classes = new Set();
    $('div').each((i, el) => {
      const cls = $(el).attr('class');
      if (cls) classes.add(cls);
    });
    console.log("Div classes found:", Array.from(classes).slice(0, 20));

  } catch (err) {
    console.error("Error fetching DDG:", err.message);
  }
}

diagnose();
