#!/bin/bash

source ../.env

KEY_ACCESS_TOKEN="$OPENAI_API_TOKEN" # This should be specified

getConversationId() {
  accessToken=$1
  resp=$(curl -s -H "Content-Type: application/json" -H "Authorization: Bearer $accessToken" "https://chat.openai.com/backend-api/conversations?offset=0&limit=1")
  conversationId=$(echo "$resp" | jq -r ".items[0].id")
  
  if [[ "$conversationId" == "null" || -z "$conversationId" ]]; then
    echo ""
    return
  fi
  
  echo "$conversationId"
}

deleteConversation() {
  local accessToken=$1
  local conversationId=$2

  resp=$(curl -s -X "PATCH" -H "Content-Type: application/json" -H "Authorization: Bearer $accessToken" -d '{"is_visible": false}' "https://chat.openai.com/backend-api/conversation/$conversationId")
  success=$(echo "$resp" | jq -r ".success")
  
  [[ "$success" == "true" ]]
}

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

  echo "DEBUG: Sending request with data:"
  echo "$messageJson"
  
  curl -s -N -X "POST" \
       -H "Content-Type: application/json" \
       -H "Authorization: Bearer $accessToken" \
       -H "Accept: text/event-stream" \
       --data "$messageJson" \
       "https://chat.openai.com/backend-api/conversation" | while IFS= read -r line
  do
    echo "DEBUG: Received event: $line"
    if [[ $line == data:* ]]; then
      message=$(echo "$line" | cut -d' ' -f2-)
      # Assuming the data message is a JSON formatted string
      text=$(echo "$message" | jq -r '.message?.content?.parts?[0]')
      if [[ $text != "null" && -n $text ]]; then
        echo "DEBUG: Extracted text: $text"
        echo "$text"
      fi
    elif [[ $line == "[DONE]" ]]; then
      break  # exit when we encounter [DONE]
    fi
  done
}
debugDirectCurl() {
  local accessToken="$1"

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
        "parts": ["What's the summary of XYZ?"]
      }
    }
  ],
  "model": "text-davinci-002-render",
  "parent_message_id": "$uuid"
}
EOL
)

  echo "DEBUG: Direct curl command with data:"
  echo "$messageJson"

  # Send direct curl command
  curl -N -X "POST" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $accessToken" \
  -H "Accept: text/event-stream" \
  --data "$messageJson" \
  "https://chat.openai.com/backend-api/conversation"
}

# Use the function:
token=$KEY_ACCESS_TOKEN
debugDirectCurl "$token"





# The getSummary function is tricky as the original code seems to use an SSE endpoint. 
# Bash isn't exactly designed for handling SSE so I'm going to omit that for simplicity.

# And you can call these functions like so:
# token=$(getAccessToken)
# token=$KEY_ACCESS_TOKEN
# echo "Token length: ${#token}"


# # Usage:
# question="What's the summary of XYZ?"
# summary=$(getSummary "$token" "$question")
# echo "Summary: $summary"

# conversationId=$(getConversationId $token)
# echo "Conversation ID: $conversationId"

# if deleteConversation "$token" "$conversationId"; then
#   echo "Successfully deleted conversation"
# else
#   echo "Failed to delete conversation"
# fi

