#!/bin/bash

URL="https://chat.openai.com/backend-api/conversation"


#!/bin/bash

uuidv4() {
  uuidgen
}

message2Json() {
  local question="$1"

  local messageJson=$(cat <<EOF
{
  "action": "next",
  "messages": [
    {
      "id": "$(uuidv4)",
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
  "parent_message_id": "$(uuidv4)"
}
EOF
)

  echo "$messageJson"
}


echo "Enter your question: "
read question
messageJson=$(message2Json "$question")
echo "$messageJson"
