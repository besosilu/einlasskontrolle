import type { Request, Response, NextFunction } from 'express';
import * as pricesService from '../services/prices.service.js';

export async function list(_req: Request, res: Response, next: NextFunction) {
  try {
    const items = await pricesService.listPrices();
    res.json(items);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { category, name, description, price, period, active } = req.body as {
      category: string;
      name: string;
      description?: string;
      price: number;
      period?: string;
      active?: boolean;
    };

    if (!category || !['membership', 'course'].includes(category)) {
      return res.status(400).json({ error: 'Kategorie muss "membership" oder "course" sein' });
    }
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Name ist erforderlich' });
    }
    if (price === undefined || price === null || isNaN(Number(price)) || Number(price) < 0) {
      return res.status(400).json({ error: 'Gültiger Preis ist erforderlich' });
    }

    const item = await pricesService.createPrice({
      category: category as 'membership' | 'course',
      name,
      description,
      price: Number(price),
      period,
      active,
    });
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params['id']);
    const { name, description, price, period, active } = req.body as {
      name?: string;
      description?: string | null;
      price?: number;
      period?: string | null;
      active?: boolean;
    };

    const item = await pricesService.updatePrice(id, {
      name,
      description,
      price: price !== undefined ? Number(price) : undefined,
      period,
      active,
    });
    res.json(item);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await pricesService.deletePrice(Number(req.params['id']));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
