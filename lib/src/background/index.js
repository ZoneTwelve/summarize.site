import ExpiryMap from "expiry-map";
import { v4 as uuidv4 } from "uuid";
import yaml from "js-yaml";
import { fetchSSE } from "./fetch-sse.js";

let ua = navigator.userAgent;
let browserName = ua.indexOf("Chrome") > -1 ? "Chrome" : "Firefox";
let CORE = browserName === "Chrome" ? chrome : browser;

const KEY_ACCESS_TOKEN = "accessToken";

let prompt = "";
let prompt_index = 0;
let experiment = {
  "name": "Special News Conclusion",
  "prompt": `---

  **News Concluding Prompt**
  
  Please read the provided news content and summarize the main conclusions in Traditional Chinese. Fill in the appropriate fields below. Ensure you only use the given format and do not add anything extra.
  
  **News Content:**  
  [NEWS_CONTENT]
  
  **Output:**  
  
  \`\`\`yaml
  News:
    BulletPoints:
      - Keyword-1: [Insert conclusion-1 in Traditional Chinese here]
      - Keyword-2: [Insert conclusion-2 in Traditional Chinese here]
      - Keyword-3: [Insert conclusion-3 in Traditional Chinese here]
      - Keyword-4: [Insert conclusion-4 in Traditional Chinese here]
      - Keyword-5: [Insert conclusion-5 in Traditional Chinese here]
    MultipleNewsInOne: [True/False]
  \`\`\`
  
  ---
  
  `,
  "keywords": {
    "NEWS_CONTENT": "News Content",
  }
};
let apiKey = "";
CORE.storage.sync.get(["prompt", "apiKey"], function (items) {
  if (items && items.prompt) {
    prompt = items.prompt;
  } else {
    // Choose default (en) prompt
    prompt = "You are acting as a summarization AI, and for the input text please summarize it to the most important 3 to 5 bullet points for brevity: "
  }
  if (items && items.apiKey) {
    apiKey = items.apiKey;
  }
});

const cache = new ExpiryMap(10 * 1000);

async function getAccessToken() {
  if (cache.get(KEY_ACCESS_TOKEN)) {
    return cache.get(KEY_ACCESS_TOKEN);
  }
  const resp = await fetch("https://chat.openai.com/api/auth/session")
    .then((r) => r.json())
    .catch(() => ({}));
  if (!resp.accessToken) {
    throw new Error("UNAUTHORIZED");
  }
  cache.set(KEY_ACCESS_TOKEN, resp.accessToken);
  return resp.accessToken;
}

async function getConversationId() {
  const accessToken = await getAccessToken();
  const resp = await fetch(
    "https://chat.openai.com/backend-api/conversations?offset=0&limit=1",
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )
    .then((r) => r.json())
    .catch(() => ({}));
  if (resp?.items?.length === 1) {
    return resp.items[0].id;
  }
  return "";
}

async function deleteConversation(conversationId) {
  const accessToken = await getAccessToken();
  const resp = await fetch(
    `https://chat.openai.com/backend-api/conversation/${conversationId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ is_visible: false }),
    }
  )
    .then((r) => r.json())
    .catch(() => ({}));
  if (resp?.success) {
    return true;
  }
  return false;
}

async function getSummary(question, stream_callback, done_callback) {
  const accessToken = await getAccessToken();
  const messageJson = {
    action: "next",
    messages: [
      {
        id: uuidv4(),
        author: {
          role: "user",
        },
        role: "user",
        content: {
          content_type: "text",
          parts: [question],
        },
      },
    ],
    model: "text-davinci-002-render",
    parent_message_id: uuidv4(),
  };
  await fetchSSE("https://chat.openai.com/backend-api/conversation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(messageJson),
    onMessage(message) {
      let callback = message === "[DONE]" ? done_callback : stream_callback;
      if(message === "[DONE]") {
        return callback(message);
      }
      try {
        const data = JSON.parse(message);
        const text = data.message?.content?.parts?.[0];
        if (text) {
          callback(text);
        }
      } catch (err) {
        console.log("sse message", message);
        console.log(`Error in onMessage: ${err}`);
      }
    },
    onError(err) {
      console.log(`Error in fetchSSE: ${err}`);
    },
  });
}

let preventInstance = {};
function executeScripts(tab) {
  const tabId = tab.id;
  // return if we've already created the summary for this website
  if (preventInstance[tabId]) return;

  preventInstance[tabId] = true;
  setTimeout(() => delete preventInstance[tabId], 10000);

  // Add a badge to signify the extension is in use
  CORE.action.setBadgeBackgroundColor({ color: [242, 38, 19, 230] });
  CORE.action.setBadgeText({ text: "GPT" });

  CORE.scripting.executeScript({
    target: { tabId },
    files: ["content.bundle.js"],
  });

  setTimeout(function () {
    CORE.action.setBadgeText({ text: "" });
  }, 1000);
}

// Load on clicking the extension icon
CORE.action.onClicked.addListener(async (...args) => {
  let tab = args[0];
  // Add request permission for "https://*.openai.com/"
  // Without this request permission, User should enable optional permission for "https://*.openai.com/"
  if(browserName === "Firefox") {
    CORE.permissions.request({
      origins: ["https://*.openai.com/"],
    });
  }
  executeScripts(...args);
});

// Listen for messages
CORE.runtime.onConnect.addListener((port) => {
  port.onMessage.addListener(async (request, sender, sendResponse) => {
    console.debug("received msg ", request.content);
    try {
      const maxLength = 3000;
      const text = request.content;
      console.debug('Text:', text)
      const chunks = splitTextIntoChunks(text, maxLength);

      let currentSummary = "";
      let summaries = [];
      let summariesIndex = 0;
      for (const chunk of chunks) {
        let inputs = {
          'NEWS_CONTENT': chunk
        };
        let gptQuestion = null;
        if (experiment != null) {
          let prompt = experiment.prompt;
          for(let kw in experiment.keywords) {
            prompt = prompt.replace(`[${kw}]`, inputs[kw]);
          }
          gptQuestion = prompt;
        }else{
          gptQuestion = prompt + `\n\n${chunk}`;
        }
        console.log(gptQuestion)
        if(gptQuestion == null) {
          port.postMessage({ error: "No prompt found" });
          return;
        }
        let currentAnswer = "";
        await getSummary(gptQuestion, (answer) => {
          currentAnswer = answer;
          summaries[summariesIndex] = answer;
          port.postMessage({
            answer: combineSummaries([currentSummary, answer]),
          });
        }, () => {
          let answer = summaries[summariesIndex];
          let currentAnswer = "";
          let yaml_regex = /```yaml\n([\s\S]*)\n```/g;
          let yaml_match = yaml_regex.exec(answer);
          if (yaml_match != null) {
            let yaml_str = yaml_match[1];
            let yaml_obj = yaml.load(yaml_str);
            console.log(yaml_obj)
            if('News' in yaml_obj && 'BulletPoints' in yaml_obj['News']){
              let bulletPoints = yaml_obj['News']['BulletPoints'];
              currentAnswer = bulletPoints.map((item, index) => {
                let key = Object.keys(item)[0];
                return `${index+1}. ${item[key]}`;
              }).join('\n\n');
            }
          }
          summaries[summariesIndex++] = currentAnswer;
          console.log(summaries)
        });
        await deleteConversation(await getConversationId());
      }
    } catch (err) {
      console.error(err);
      port.postMessage({ error: err.message });
      cache.delete(KEY_ACCESS_TOKEN);
    }
  });
});

function splitTextIntoChunks(text, maxLength) {
  const chunks = [];
  const words = text.split(/\s+/);
  let currentChunk = "";

  for (const word of words) {
    if (currentChunk.length + word.length + 1 <= maxLength) {
      currentChunk += (currentChunk ? " " : "") + word;
    } else {
      chunks.push(currentChunk);
      currentChunk = word;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function combineSummaries(summaries) {
  let combinedSummary = "";
  for (const summary of summaries) {
    combinedSummary += (combinedSummary ? " " : "") + summary;
  }

  return combinedSummary;
}
