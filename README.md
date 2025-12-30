# AI, Noted 

## Table  of Contents
1. Introduction
2. Features
3. WHat's next
4. How to set up

## Introduction
If you find watching long videos and taking notes from those difficult and exhausting, you are not alone. Many people, especially the younger generation, do not find taking long notes from videos that are 15+ minutes an easy task to do. They may feel overwhelmed by the sheer volume of the content, or the fact that the instructor has not taught the content well. Zoning out after a few minutes is also a big issue. Therefore, here is **AI, Noted**: an app where users can upload audio clips, where notes, in any format, magically appear with only a few clicks.

## Features
AI, Noted has several feature that can help make the AI-generated notes more personal towards you, inclcuding depth and context. Here are some of the features currently available to users:
- An file select box for the user to upload audio clips
- A button where the app can transcribe the audio and extract what the person is saying
- A slider indicating the depth of the notes
- Input box where the user can specify the context and purpose of the notes, allowing more personalized notes
- Five different note formats, which are the Outline Method, the Sentence Method, the Charting Method, the Mind Map Method, and the Cornell method of note-taking.
- Download the notes for future reference

## What's Next
Although this program is complete, there are still some extra features that I will add to the project as the time progresses:
- Improve the UX of the buttons of the program
- Ensure less wait-time when transcribing audio
- Incorporate functionality to convert any audio file, not just a ```.wav```
- Add accessibility features
- Make a login system for notes to be saved on the internet, without the user having to download it.

## How to set up
Here are the steps in order to run this app on your local machine.
1. Download the repo
2. Download Node.js (if not already installed)
3. Using a terminal, enter the command, ```npm i```
4. Create a Gemini API key, and for the STT API, create a JSON key, and save it to the ```google_json_key``` folder
5. Create an ```.env``` file, and add the following lines:
```
# Replace the alues with your real JSON key path, and your own Gemini key
GOOGLE_JSON_KEY_PATH=google_json_key\gen-lang-client-0553672861-6cb35e7ba7c7.json 
GOOGLE_GEMINI_KEY=AiZA.......
```
5. Enter the command, ```npm run dev``` to run the project
