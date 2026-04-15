import { DefaultAgentWorkflowService } from '@/application/agent-workflow/service';
import {
  AirtableIntegrationSecretProvider,
  AirtableWorkflowRepository,
  AirtableWorkflowRunRepository,
  LlmAgentModelRunner,
} from '@/infrastructure/agent-workflow/airtable-repositories';

export function createAgentWorkflowService() {
  const workflowRepository = new AirtableWorkflowRepository();
  const runRepository = new AirtableWorkflowRunRepository();
  const secretProvider = new AirtableIntegrationSecretProvider();
  const modelRunner = new LlmAgentModelRunner(secretProvider);

  return new DefaultAgentWorkflowService(workflowRepository, runRepository, modelRunner);
}

export const DEFAULT_TENANT_ID = 'default';
