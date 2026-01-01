import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import formidable from 'formidable';
import speech from '@google-cloud/speech';
import { Storage } from '@google-cloud/storage';
import { exec } from 'child_process';
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const BUCKET_NAME = 'audio-bucket-080211';

const storage = new Storage({
    keyFilename: process.env.GOOGLE_JSON_KEY_PATH,
    projectId: 'gen-lang-client-0553672861'
});

const speechClient = new speech.SpeechClient({
    keyFilename: process.env.GOOGLE_JSON_KEY_PATH,
    projectId: 'gen-lang-client-0553672861'
});

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_KEY });

function extractParts(cornellNotes, section) {
    const regex = new RegExp(`\\*\\*${section}\\*\\*:?\\s*([\\s\\S]*?)(?=\\n\\*\\*[A-Za-z ]+\\*\\*|$)`, 'i');
    const match = cornellNotes.match(regex);
    return match ? match[1].trim() : '';
}

async function generateNotes(prompt) {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
    });
    return response.text;
}

function convertToSTT(inputFilePath, outputFilePath) {
    return new Promise((resolve, reject) => {
        const command = `ffmpeg -y -i "${inputFilePath}" -ac 1 -ar 16000 -c:a pcm_s16le "${outputFilePath}"`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(`Error converting file: ${error.message}`);
                return;
            }
            resolve(outputFilePath);
        });
    });
}

const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/transcribe') {
        const form = formidable({
            multiples: false,
            uploadDir: path.join(__dirname, 'uploads'),
            keepExtensions: true
        });

        if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
            fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });
        }



        form.parse(req, async (err, fields, files) => {
            if (err) {
                res.writeHead(400);
                res.end('Error parsing the file: ' + err.message);
                return;
            }

            let audioFile = files.audio;
            if (Array.isArray(audioFile)) audioFile = audioFile[0];

            try {
                const inputFilePath = audioFile.filepath;
                const outputFilePath = path.join(
                    path.dirname(inputFilePath),
                    `converted-${Date.now()}.wav`
                );

                // Convert uploaded audio
                await convertToSTT(inputFilePath, outputFilePath);
                console.log(`File converted to ${outputFilePath}`);

                // Upload converted file to GCS
                const gcsDestination = `uploads/${path.basename(outputFilePath)}`;
                await storage.bucket(BUCKET_NAME).upload(outputFilePath, {
                    destination: gcsDestination
                });
                console.log(`Uploaded to gs://${BUCKET_NAME}/${gcsDestination}`);

                const request = {
                    audio: { uri: `gs://${BUCKET_NAME}/${gcsDestination}` },
                    config: {
                        encoding: 'LINEAR16',
                        languageCode: 'en-US',
                    },
                };

                const [operation] = await speechClient.longRunningRecognize(request);
                const [response] = await operation.promise();

                const transcription = response.results
                    .map(result => result.alternatives[0].transcript)
                    .join('\n');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ transcription }));

                // Cleanup temp files
                fs.unlinkSync(inputFilePath);
                fs.unlinkSync(outputFilePath);

            } catch (error) {
                res.writeHead(500);
                res.end('Error during transcription: ' + error.message);
            }
        });
        return;
    }

    if (req.method === "POST" && req.url === "/setNotesFormat") {
        let responseData = "";
        const form = formidable();

        form.parse(req, async (err, fields) => {
            if (err) {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                return res.end('Error parsing the form: ' + err.message);
            }

            const format = Array.isArray(fields.format) ? fields.format[0] : fields.format;
            const transcription = Array.isArray(fields.transcription)
                ? fields.transcription[0]
                : fields.transcription;
            const detailLevel = Array.isArray(fields.detailLevel)
                ? fields.detailLevel[0]
                : fields.detailLevel;
            const context = Array.isArray(fields.context)
                ? fields.context[0]
                : fields.context;

            console.log(transcription);
            console.log(`Notes format set to: ${format}`);
            console.log(`Transcription is : ${transcription.substring(0, 30)}...`);
            if (format && transcription && detailLevel && context !== undefined) {
                // Here you can implement the logic to generate notes based on the format and transcription
                switch (format) {
                    case "outline":
                        console.log("Generating outline notes...");
                        let promptOutline = `Please generate outline notes based on the following transcription:\n\n${transcription}.
                        The user has requested a detail level of ${detailLevel} out of 100, where 0 is just the key points and 100 is as much relevant information as possible.
                        The purpose of these notes is related to ${context}.`;
                        const notesOutline = await generateNotes(promptOutline);
                        console.log("Generated Notes:\n", notesOutline);
                        responseData = notesOutline;
                        break;
                    case "sentence":
                        console.log("Generating sentence notes...");
                        let promptSentence = `Please generate sentence-style notes based on the following transcription:\n\n${transcription}
                        The user has requested a detail level of ${detailLevel} out of 100, where 0 is just the key points and 100 is as much relevant information as possible.
                        The purpose of these notes is related to ${context}.`;
                        const notesSentence = await generateNotes(promptSentence);
                        console.log("Generated Notes:\n", notesSentence);
                        responseData = notesSentence;
                        break;
                    case "cornell":
                        console.log("Generating Cornell notes...");
                        //variables for the parts of cornell notes can be added here
                        //the parts of cornell notes are: cues, notes, summary
                        let header = "";
                        let cues = "";
                        let notes = "";
                        let summary = "";
                        let promptCornell = `I would like cornell notes generated for the following transcription.
                        The user has requested a detail level of ${detailLevel} out of 100, where 0 is just the key points and 100 is as much relevant information as possible.
                        The purpose of these notes is related to ${context}.
                        Please provide the notes, by giving a good header, cues, notes, and summary. 
                        Furthermore, format the notes with clear labels for each section, with
                        "**Header**", "**Cues**", "**Notes**", and "**Summary**", for the respective sections.
                        \n
                        Transcription: ${transcription}`;
                        const cornellNotes = await generateNotes(promptCornell);
                        header = extractParts(cornellNotes, "Header");
                        cues = extractParts(cornellNotes, "Cues");
                        notes = extractParts(cornellNotes, "Notes");
                        summary = extractParts(cornellNotes, "Summary");

                        console.log("Generated Cornell Notes:");
                        console.log("Header:", header);
                        console.log("Cues:", cues);
                        console.log("Notes:", notes);
                        console.log("Summary:", summary);
                        responseData = {
                            header: header,
                            cues: cues,
                            notes: notes,
                            summary: summary
                        };



                        break;
                    case "mindmap":
                        console.log("Generating mind map notes...");
                        // Make the AI provide the mind map in an object format, like a file directory system. This will make it easier to parse and display later.
                        let promptMindmap = `Please generate mind map notes based on the following transcription.
                        The user has requested a detail level of ${detailLevel} out of 100, where 0 is just the key points and 100 is very detailed, with as much relevant information as possible.
                        The purpose of these notes is related to ${context}.
                        For longer transcriptions, focus on the main topics in order to reduce clutter and enhance clarity.
                        Represent the mind map in a hierarchical text format, using indentation to denote levels.
                        Do not say things like "The mind map is as follows" - just provide the object structure directly.
                        For example:
                        Main Topic
                            Subtopic 1
                                Detail A
                                Detail B
                            Subtopic 2
                                Detail C
                        \n
                        Transcription: ${transcription}`;
                        const mindMapNotes = await generateNotes(promptMindmap);
                        const lines = mindMapNotes.split('\n').filter(line => line.trim() !== '');
                        const mindMap = { topics: [] };
                        const stack = [{ level: -1, children: mindMap.topics }]
                        for (const line of lines) {
                            const indentCount = line.search(/\S/);
                            const content = line.trim().replace(/^(\*+\s*)/, '');
                            const node = { title: content, children: [] };

                            while (stack.length > 1 && indentCount <= stack[stack.length - 1].level) {
                                stack.pop();
                            }

                            stack[stack.length - 1].children.push(node);
                            stack.push({ level: indentCount, children: node.children });
                        }
                        console.log("Generated Mind Map:\n", JSON.stringify(mindMap, null, 2));
                        responseData = mindMap;

                        break;
                    case "charting":
                        console.log("Generating charting notes...");
                        let table = [];
                        const promptCharting = `You are generating notes using the CHARTING METHOD.
                        The user has requested a detail level of ${detailLevel} out of 100, where 0 is just the key points and 100 is as much relevant information as possible.
                        The purpose of these notes is related to ${context}.
                        Return the content in a table-like structure where:
                        - Each row represents one fact
                        - Column headers are: Topic, Subtopic, Description, Example
                        - Avoid prose and nesting

                        The output should be easy to convert into a 2D array, by
                        Separate columns using " | " exactly.
                        \n
                        Transcription: ${transcription}`;
                        const chartingNotes = await generateNotes(promptCharting);
                        //create 2D array from notes
                        const rows = chartingNotes.split('\n').filter(line => line.trim() !== '');
                        for (const line of rows) {
                            const values = line.split(' | ').map(val => val.trim());
                            if (values.length === 4) {
                                table.push(values);
                            }
                        }
                        console.log("Generated Charting Notes (2D Array):\n", table);
                        responseData = JSON.stringify(table, null, 2);


                        break;
                    default:
                        console.log("Unknown format. No notes generated.");
                }
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ format: format, notes: responseData }));
        });

        return;
    }



    // Serve static files
    const extension = path.extname(req.url);
    let contentType;
    switch (extension) {
        case '.css': contentType = 'text/css'; break;
        case '.js': contentType = 'text/javascript'; break;
        case '.png': contentType = 'image/png'; break;
        case '.jpg': contentType = 'image/jpeg'; break;
        case '.json': contentType = 'application/json'; break;
        default: contentType = 'text/html';
    }

    let filePath = req.url === '/' ? path.join(__dirname, 'index.html') : path.join(__dirname, req.url);
    if (!extension && req.url !== '/') filePath += '.html';

    if (fs.existsSync(filePath)) {
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading file ' + err);
                return;
            }
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        });
    } else {
        fs.readFile(path.join(__dirname, '404.html'), (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading file ' + err);
                return;
            }
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    }
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});
