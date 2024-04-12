import { BedrockAgentClient, StartIngestionJobCommand, StartIngestionJobCommandInput } from "@aws-sdk/client-bedrock-agent";
import { Handler } from "aws-lambda";

const rockerAgentClient = new BedrockAgentClient({region: process.env.REGION});

export const handler: Handler = async (event, context) => {
    const inputCommand: StartIngestionJobCommandInput = {
        dataSourceId: process.env.DATA_SOURCE_ID,
        knowledgeBaseId: process.env.KNOWLEDGE_BASE_ID,
        clientToken: context.awsRequestId
    }

    const command = new StartIngestionJobCommand(inputCommand);
    const response = await rockerAgentClient.send(command);

    return JSON.stringify({injestionJob: response.ingestionJob}, null, 2);
}