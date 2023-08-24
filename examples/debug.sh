#!/bin/bash
source ../.env
getSummary() {
  local accessToken="$1"
  local question="$2"
  local uuid=$(uuidgen)

  local messageJson=$(cat <<EOL
{
  "action": "next",
  "messages": [
    {
      "id": "$uuid",
      "author": {
        "role": "user"
      },
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
EOL
)

  # POST request and extract data lines from SSE
  response=$(curl -s -X "POST" \
       -H "Content-Type: application/json" \
       -H "Authorization: Bearer $accessToken" \
       --data "$messageJson" \
       "https://chat.openai.com/backend-api/conversation" | grep '^data:')

  # If we have a data line, parse it with jq
  if [[ ! -z "$response" ]]; then
    echo "$response" | sed 's/^data: //' | jq
  else
    echo "No data received."
  fi
}

token="$OPENAI_API_TOKEN"
echo "Token length: ${#token}"

# Usage:
question="What's the summary of XYZ?"
summary=$(getSummary "$token" "$question")
echo "Summary: $summary"

