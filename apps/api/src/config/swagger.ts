import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import { config } from './index';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CareCompanion API',
      version: '1.0.0',
      description: `
# CareCompanion API Documentation

API for managing family caregiving coordination including:
- **Family Management**: Create and manage family care teams
- **Patient Care**: Track patient information and care needs
- **Medications**: Manage medication schedules and tracking
- **Journal**: Record daily observations and concerns
- **Documents**: Store and parse medical documents
- **Care Tasks**: Coordinate care responsibilities
- **AI Insights**: Get AI-powered care recommendations

## Authentication
All endpoints require authentication via Clerk. Include the session token in the Authorization header:
\`\`\`
Authorization: Bearer <session_token>
\`\`\`

## Rate Limiting
- Standard endpoints: 100 requests/15 minutes
- Auth endpoints: 10 requests/15 minutes
- AI endpoints: 20 requests/15 minutes
- File uploads: 30 requests/15 minutes
      `,
      contact: {
        name: 'CareCompanion Support',
        email: 'support@carecompanion.com',
      },
    },
    servers: [
      {
        url: config.nodeEnv === 'production'
          ? 'https://api.carecompanion.com'
          : `http://localhost:${config.port}`,
        description: config.nodeEnv === 'production' ? 'Production' : 'Development',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Clerk session token',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
        Family: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            subscriptionTier: { type: 'string', enum: ['free', 'premium', 'enterprise'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Patient: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            dateOfBirth: { type: 'string', format: 'date' },
            diagnosis: { type: 'string' },
          },
        },
        Medication: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            dosage: { type: 'string' },
            frequency: { type: 'string' },
            scheduleTime: { type: 'array', items: { type: 'string' } },
            isActive: { type: 'boolean' },
          },
        },
        JournalEntry: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            content: { type: 'string' },
            sentiment: { type: 'string', enum: ['positive', 'neutral', 'concerned', 'urgent'] },
            isPrivate: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Document: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            type: { type: 'string', enum: ['medical_record', 'financial', 'legal', 'insurance', 'other'] },
            url: { type: 'string', format: 'uri' },
            parsingStatus: { type: 'string', enum: ['pending', 'processing', 'completed', 'failed'] },
          },
        },
        CareTask: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            description: { type: 'string' },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
            status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'] },
            dueDate: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [{ BearerAuth: [] }],
    tags: [
      { name: 'Family', description: 'Family and member management' },
      { name: 'Patient', description: 'Patient information and care' },
      { name: 'Medications', description: 'Medication tracking and schedules' },
      { name: 'Journal', description: 'Care observations and notes' },
      { name: 'Documents', description: 'Document storage and AI parsing' },
      { name: 'Care Tasks', description: 'Task coordination' },
      { name: 'AI', description: 'AI-powered insights and chat' },
      { name: 'Calendar', description: 'Calendar integration' },
      { name: 'Nutrition', description: 'Meal tracking and nutrition' },
    ],
  },
  apis: ['./src/routes/*.ts', './src/routes/**/*.ts'],
};

const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Express): void {
  // Swagger UI
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'CareCompanion API Docs',
  }));

  // JSON spec endpoint
  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}

export { swaggerSpec };
