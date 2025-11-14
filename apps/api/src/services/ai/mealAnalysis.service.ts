import OpenAI from 'openai';
import { z } from 'zod';
import { logger } from '../../utils/logger';
import { NutritionRecommendation, MealType } from '@prisma/client';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Zod schema for structured meal analysis output
 */
export const MealAnalysisSchema = z.object({
  nutritionData: z.object({
    estimatedCalories: z.number().optional(),
    proteinGrams: z.number().optional(),
    carbsGrams: z.number().optional(),
    fatGrams: z.number().optional(),
    sodiumMg: z.number().optional(),
    fiberGrams: z.number().optional(),
    sugarGrams: z.number().optional(),
    portionSize: z.string().optional(),
    foodItems: z.array(z.string()),
  }),
  meetsGuidelines: z.boolean().optional(),
  concerns: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  confidence: z.enum(['high', 'medium', 'low']),
  reasoning: z.string().optional(),
});

export type MealAnalysisResult = z.infer<typeof MealAnalysisSchema>;

/**
 * Service for analyzing meals using GPT-5.1 Vision API
 * Provides nutrition estimation, safety checks, and guideline compliance
 */
export class MealAnalysisService {
  /**
   * Analyze a meal from a photo using GPT-5.1 Vision
   */
  async analyzeMealFromPhoto(params: {
    photoUrl: string;
    nutritionGoals?: NutritionRecommendation | null;
    mealType: MealType;
    patientContext?: {
      allergies?: string[];
      dietaryRestrictions?: string[];
      texture?: 'regular' | 'soft' | 'pureed';
    };
  }): Promise<MealAnalysisResult> {
    try {
      logger.info('Analyzing meal photo with GPT-5.1 Vision', {
        mealType: params.mealType,
        hasGuidelines: !!params.nutritionGoals,
      });

      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildAnalysisPrompt(
        params.mealType,
        params.nutritionGoals,
        params.patientContext
      );

      const response = await openai.chat.completions.create({
        model: 'gpt-5.1',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: userPrompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: params.photoUrl,
                  detail: 'high', // Use high detail for better food identification
                },
              },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3, // Lower temperature for more consistent analysis
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from GPT-5.1 Vision API');
      }

      const parsed = JSON.parse(content);
      const validated = MealAnalysisSchema.parse(parsed);

      logger.info('Meal analysis completed', {
        foodItems: validated.nutritionData.foodItems.length,
        concerns: validated.concerns.length,
        confidence: validated.confidence,
      });

      return validated;
    } catch (error) {
      logger.error('Error analyzing meal photo:', error);
      throw error;
    }
  }

  /**
   * Analyze multiple photos of the same meal
   * Useful for different angles or multiple plates
   */
  async analyzeMultiplePhotos(params: {
    photoUrls: string[];
    nutritionGoals?: NutritionRecommendation | null;
    mealType: MealType;
    patientContext?: {
      allergies?: string[];
      dietaryRestrictions?: string[];
      texture?: 'regular' | 'soft' | 'pureed';
    };
  }): Promise<MealAnalysisResult> {
    try {
      logger.info('Analyzing multiple meal photos with GPT-5.1 Vision', {
        photoCount: params.photoUrls.length,
        mealType: params.mealType,
      });

      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildMultiPhotoPrompt(
        params.mealType,
        params.nutritionGoals,
        params.patientContext,
        params.photoUrls.length
      );

      // Build content array with all photos
      const imageContent = params.photoUrls.map((url) => ({
        type: 'image_url' as const,
        image_url: {
          url,
          detail: 'high' as const,
        },
      }));

      const response = await openai.chat.completions.create({
        model: 'gpt-5.1',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: userPrompt,
              },
              ...imageContent,
            ],
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from GPT-5.1 Vision API');
      }

      const parsed = JSON.parse(content);
      const validated = MealAnalysisSchema.parse(parsed);

      logger.info('Multi-photo meal analysis completed', {
        photoCount: params.photoUrls.length,
        foodItems: validated.nutritionData.foodItems.length,
        concerns: validated.concerns.length,
      });

      return validated;
    } catch (error) {
      logger.error('Error analyzing multiple meal photos:', error);
      throw error;
    }
  }

  /**
   * Analyze meal from voice note transcription
   * Used when caregiver describes meal verbally
   */
  async analyzeMealFromDescription(params: {
    description: string;
    nutritionGoals?: NutritionRecommendation | null;
    mealType: MealType;
    patientContext?: {
      allergies?: string[];
      dietaryRestrictions?: string[];
    };
  }): Promise<MealAnalysisResult> {
    try {
      logger.info('Analyzing meal from description', {
        mealType: params.mealType,
        descriptionLength: params.description.length,
      });

      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildDescriptionPrompt(
        params.description,
        params.mealType,
        params.nutritionGoals,
        params.patientContext
      );

      const response = await openai.chat.completions.create({
        model: 'gpt-5.1',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from GPT-5.1 API');
      }

      const parsed = JSON.parse(content);
      const validated = MealAnalysisSchema.parse(parsed);

      logger.info('Description-based meal analysis completed');

      return validated;
    } catch (error) {
      logger.error('Error analyzing meal from description:', error);
      throw error;
    }
  }

  /**
   * Build system prompt for meal analysis
   */
  private buildSystemPrompt(): string {
    return `You are a clinical nutrition analyst helping family caregivers track meals for elderly patients with cognitive decline.

IMPORTANT CONTEXT:
- Patient may have dietary restrictions (low-sodium, diabetic-friendly, soft-foods, texture modifications)
- Caregivers are stressed and need actionable, supportive insights
- Focus on safety concerns: choking hazards, allergens, texture appropriateness
- Focus on nutrition gaps: insufficient protein, excessive sodium, hydration
- Be supportive and constructive, never judgmental

SAFETY PRIORITIES:
1. Choking hazards (hard foods, whole grapes, nuts, tough meats for patients with swallowing issues)
2. Allergen exposure
3. Texture appropriateness (if patient requires soft/pureed foods)
4. Medication interactions (e.g., grapefruit, vitamin K for warfarin patients)

NUTRITION PRIORITIES:
1. Adequate protein (critical for elderly patients)
2. Hydration (often overlooked)
3. Fiber for digestive health
4. Sodium management (heart health, blood pressure)
5. Sugar management (diabetes)

OUTPUT FORMAT:
Return ONLY valid JSON matching this schema:
{
  "nutritionData": {
    "estimatedCalories": number (optional),
    "proteinGrams": number (optional),
    "carbsGrams": number (optional),
    "fatGrams": number (optional),
    "sodiumMg": number (optional),
    "fiberGrams": number (optional),
    "sugarGrams": number (optional),
    "portionSize": string (optional, e.g., "1 cup", "medium plate"),
    "foodItems": string[] (list all identifiable foods)
  },
  "meetsGuidelines": boolean (optional, true if meets nutrition goals),
  "concerns": string[] (safety or nutrition concerns),
  "recommendations": string[] (supportive suggestions),
  "confidence": "high" | "medium" | "low",
  "reasoning": string (optional, brief explanation of analysis)
}

Be realistic about uncertainty - if you can't clearly see all foods, mark confidence as "medium" or "low".`;
  }

  /**
   * Build user prompt for single photo analysis
   */
  private buildAnalysisPrompt(
    mealType: MealType,
    nutritionGoals?: NutritionRecommendation | null,
    patientContext?: {
      allergies?: string[];
      dietaryRestrictions?: string[];
      texture?: 'regular' | 'soft' | 'pureed';
    }
  ): string {
    const mealTypeLabel = mealType.toLowerCase();

    let prompt = `Analyze this ${mealTypeLabel} meal photo.\n\n`;

    // Add nutrition goals if available
    if (nutritionGoals) {
      prompt += `NUTRITION GOALS:\n`;
      if (nutritionGoals.dailyCalories) {
        const mealCalories = this.estimateMealCalories(mealType, nutritionGoals.dailyCalories);
        prompt += `- Target for this ${mealTypeLabel}: ~${mealCalories} calories\n`;
      }
      if (nutritionGoals.proteinGrams) {
        const mealProtein = Math.round(nutritionGoals.proteinGrams / 3);
        prompt += `- Target protein: ~${mealProtein}g\n`;
      }
      if (nutritionGoals.restrictions && nutritionGoals.restrictions.length > 0) {
        prompt += `- Restrictions: ${nutritionGoals.restrictions.join(', ')}\n`;
      }
      if (nutritionGoals.goals && nutritionGoals.goals.length > 0) {
        prompt += `- Goals: ${nutritionGoals.goals.join(', ')}\n`;
      }
      if (nutritionGoals.specialInstructions) {
        prompt += `- Special instructions: ${nutritionGoals.specialInstructions}\n`;
      }
      prompt += '\n';
    }

    // Add patient context
    if (patientContext) {
      prompt += `PATIENT CONTEXT:\n`;
      if (patientContext.allergies && patientContext.allergies.length > 0) {
        prompt += `- Allergies: ${patientContext.allergies.join(', ')}\n`;
      }
      if (patientContext.dietaryRestrictions && patientContext.dietaryRestrictions.length > 0) {
        prompt += `- Dietary restrictions: ${patientContext.dietaryRestrictions.join(', ')}\n`;
      }
      if (patientContext.texture) {
        prompt += `- Required texture: ${patientContext.texture}\n`;
      }
      prompt += '\n';
    }

    prompt += `ANALYSIS REQUESTED:
1. Identify all visible food items
2. Estimate nutrition values (calories, protein, carbs, fat, sodium, fiber, sugar)
3. Assess portion size appropriateness
4. Check for safety concerns (choking hazards, allergens, texture issues)
5. Evaluate if meal meets nutrition goals
6. Provide supportive recommendations if needed

Return your analysis as JSON matching the schema.`;

    return prompt;
  }

  /**
   * Build prompt for multiple photos
   */
  private buildMultiPhotoPrompt(
    mealType: MealType,
    nutritionGoals?: NutritionRecommendation | null,
    patientContext?: {
      allergies?: string[];
      dietaryRestrictions?: string[];
      texture?: 'regular' | 'soft' | 'pureed';
    },
    photoCount: number
  ): string {
    const basePrompt = this.buildAnalysisPrompt(mealType, nutritionGoals, patientContext);

    return `You will see ${photoCount} photos of the SAME meal from different angles.

${basePrompt}

IMPORTANT: Combine information from all photos but avoid double-counting. If you see the same food item in multiple photos, count it once.`;
  }

  /**
   * Build prompt for text description analysis
   */
  private buildDescriptionPrompt(
    description: string,
    mealType: MealType,
    nutritionGoals?: NutritionRecommendation | null,
    patientContext?: {
      allergies?: string[];
      dietaryRestrictions?: string[];
    }
  ): string {
    const mealTypeLabel = mealType.toLowerCase();

    let prompt = `A caregiver described this ${mealTypeLabel} meal:\n\n"${description}"\n\n`;

    if (nutritionGoals) {
      prompt += `NUTRITION GOALS:\n`;
      if (nutritionGoals.dailyCalories) {
        const mealCalories = this.estimateMealCalories(mealType, nutritionGoals.dailyCalories);
        prompt += `- Target for this ${mealTypeLabel}: ~${mealCalories} calories\n`;
      }
      if (nutritionGoals.proteinGrams) {
        const mealProtein = Math.round(nutritionGoals.proteinGrams / 3);
        prompt += `- Target protein: ~${mealProtein}g\n`;
      }
      if (nutritionGoals.restrictions && nutritionGoals.restrictions.length > 0) {
        prompt += `- Restrictions: ${nutritionGoals.restrictions.join(', ')}\n`;
      }
      if (nutritionGoals.goals && nutritionGoals.goals.length > 0) {
        prompt += `- Goals: ${nutritionGoals.goals.join(', ')}\n`;
      }
      prompt += '\n';
    }

    if (patientContext) {
      prompt += `PATIENT CONTEXT:\n`;
      if (patientContext.allergies && patientContext.allergies.length > 0) {
        prompt += `- Allergies: ${patientContext.allergies.join(', ')}\n`;
      }
      if (patientContext.dietaryRestrictions && patientContext.dietaryRestrictions.length > 0) {
        prompt += `- Dietary restrictions: ${patientContext.dietaryRestrictions.join(', ')}\n`;
      }
      prompt += '\n';
    }

    prompt += `Based on this description, provide your best estimate of:
1. Food items consumed
2. Approximate nutrition values
3. Any potential concerns
4. Supportive recommendations

Mark confidence as "low" or "medium" since this is description-based (no photo).

Return your analysis as JSON matching the schema.`;

    return prompt;
  }

  /**
   * Estimate target calories for a specific meal
   */
  private estimateMealCalories(mealType: MealType, dailyCalories: number): number {
    const distribution: Record<MealType, number> = {
      BREAKFAST: 0.25,
      LUNCH: 0.35,
      DINNER: 0.35,
      SNACK: 0.05,
      OTHER: 0.25,
    };

    return Math.round(dailyCalories * distribution[mealType]);
  }
}

export const mealAnalysisService = new MealAnalysisService();
