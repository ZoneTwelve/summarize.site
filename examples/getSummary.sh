#!/bin/bash

# Extract accessToken from .env
source ../.env
accessToken=$OPENAI_API_TOKEN

# Ensure the accessToken is being loaded correctly by showing its length
echo "Length of Loaded Access Token: ${#accessToken}"

getSummary() {
  local question="$1"
  local uuid=$(uuidgen)
  local data=$(cat <<- EOM
{
  "action": "next",
  "messages": [
    {
      "id": "$uuid",
      "author": { "role": "user" },
      "role": "user",
      "content": {
        "content_type": "text",
        "parts": ["$question"]
      }
    }
  ],
  "model": "text-davinci-002-render",
  "parent_message_id": "$uuid"
}
EOM
)

  echo "Request Data: $data"

  # Use curl to make the request
  response=$(curl -s -H "Content-Type: application/json" -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36" -H "Authorization: Bearer $accessToken" -X POST -d "$data" "https://chat.openai.com/backend-api/conversation")

  # Display raw API response for debugging
  echo "API Response: $response"

  # Extracting the message content using jq
  summary=$(echo "$response" | jq -r '.message?.content?.parts?[0]')
  echo "Extracted Summary: $summary"
}

# Testing the function
question="Your question here."
getSummary "$question"
