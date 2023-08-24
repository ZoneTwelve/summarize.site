#!/usr/bin/env python
import requests
import json

from argparse import ArgumentParser

def get_openai_summary(token):
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {token}',
        'Accept': 'text/event-stream'
    }
    
    data = {
        "action": "next",
        "messages": [
            {
                "id": "YOUR_UUID_HERE",  # Generate and use your UUID here
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
        "parent_message_id": "YOUR_UUID_HERE"  # Same UUID as above
    }

    print("Debug")
    response = requests.post('https://chat.openai.com/backend-api/conversation', headers=headers, data=json.dumps(data), stream=True)
    print(response)
    for line in response.iter_lines():
        if line:
            decoded_line = line.decode('utf-8')
            if not decoded_line.startswith("data:"):
                continue
            payload = json.loads(decoded_line[6:])
            print(payload)

if __name__ == '__main__':
    # --token
    parser = ArgumentParser()
    parser.add_argument('--token', type=str, default=None, help='OpenAI API token')
    args = parser.parse_args()
    TOKEN = args.token
    print("Getting OpenAI summary...")
    print(f"Token length: {len(TOKEN)}")
    get_openai_summary(TOKEN)
