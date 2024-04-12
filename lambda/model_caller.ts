import { BedrockAgentRuntimeClient, RetrieveAndGenerateCommand, RetrieveAndGenerateCommandInput } from "@aws-sdk/client-bedrock-agent-runtime";
import { Handler } from "aws-lambda";

const raggedRuntimeClient = new BedrockAgentRuntimeClient({region: process.env.REGION});
const contentType = 'text/html';

export const handler: Handler = async (event, context) => {

    const badResponse = {
        statusCode: 400,
        headers: {
            'Content-Type': `${contentType}`
        },
        body: 'Invalid request.  Ask me a question!'
    }

    if (event.body && event.body !== "") {
        let body = JSON.parse(event.body);
        if (body.question && body.question !== "") {
            let question = body.question;
            
            const inputCommand: RetrieveAndGenerateCommandInput = {
                input: {text: question},
                retrieveAndGenerateConfiguration: {
                    type: 'KNOWLEDGE_BASE',
                    knowledgeBaseConfiguration: {
                        knowledgeBaseId: process.env.KNOWLEDGE_BASE_ID,
                        modelArn: process.env.MODEL_ARN,
                        // generationConfiguration: {
                        //     promptTemplate: {
                        //         textPromptTemplate: 'You are a helpful robot'
                        //     }
                        // }
                    }
                }
            }
            
            const command = new RetrieveAndGenerateCommand(inputCommand);
            const response = await raggedRuntimeClient.send(command);
    
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': `${contentType}`
                },
                body: response.output?.text
            }
        } else {
            return badResponse;
        }
    } else {
        return badResponse;
    }
}