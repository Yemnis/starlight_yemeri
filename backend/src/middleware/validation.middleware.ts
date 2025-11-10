/**
 * Request validation middleware using Joi
 */
import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { AppError } from './error.middleware';

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const message = error.details.map(detail => detail.message).join(', ');
      throw new AppError(`Validation error: ${message}`, 400);
    }

    next();
  };
};

// Validation schemas
export const schemas = {
  createCampaign: Joi.object({
    name: Joi.string().required().min(1).max(255),
    description: Joi.string().optional().max(1000),
  }),

  updateCampaign: Joi.object({
    name: Joi.string().optional().min(1).max(255),
    description: Joi.string().optional().max(1000),
  }),

  searchQuery: Joi.object({
    query: Joi.string().required().min(1),
    campaignId: Joi.string().uuid().optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    filters: Joi.object({
      mood: Joi.string().optional(),
      product: Joi.string().optional(),
      minConfidence: Joi.number().min(0).max(1).optional(),
      visualElements: Joi.array().items(Joi.string()).optional(),
    }).optional(),
  }),

  searchSimilar: Joi.object({
    sceneId: Joi.string().required(),
    limit: Joi.number().integer().min(1).max(50).optional(),
    campaignId: Joi.string().uuid().optional(),
  }),

  searchVisual: Joi.object({
    elements: Joi.array().items(Joi.string()).required().min(1),
    campaignId: Joi.string().uuid().optional(),
    matchAll: Joi.boolean().optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
  }),

  sendMessage: Joi.object({
    message: Joi.string().required().min(1).max(2000),
  }),

  createConversation: Joi.object({
    campaignId: Joi.string().uuid().optional(),
  }),
};
