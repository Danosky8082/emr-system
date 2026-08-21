// routes/pricing.js
const express = require('express');

module.exports = (prisma) => {
  const router = express.Router();

  // ============================================================
  // GET all pricing services
  // ============================================================
  router.get('/', async (req, res) => {
    try {
      const pricing = await prisma.servicePricing.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' }
      });
      res.json(pricing);
    } catch (error) {
      console.error('GET /api/pricing error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // GET single pricing service
  // ============================================================
  router.get('/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID format' });
      }
      
      const pricing = await prisma.servicePricing.findUnique({
        where: { id }
      });
      
      if (!pricing) {
        return res.status(404).json({ error: 'Service not found' });
      }
      
      res.json(pricing);
    } catch (error) {
      console.error('GET /api/pricing/:id error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // POST create new pricing service
  // ============================================================
  router.post('/', async (req, res) => {
    try {
      const { name, description, category, basePrice, nhisPrice, corporatePrice, isActive } = req.body;
      
      // Validate required fields
      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }
      if (!basePrice) {
        return res.status(400).json({ error: 'Base price is required' });
      }
      
      // Check if service already exists
      const existing = await prisma.servicePricing.findUnique({
        where: { name }
      });
      
      if (existing) {
        return res.status(400).json({ error: 'Service name already exists' });
      }
      
      const basePriceNum = parseFloat(basePrice) || 0;
      
      const pricing = await prisma.servicePricing.create({
        data: {
          name,
          description: description || '',
          category: category || 'FPP',
          basePrice: basePriceNum,
          nhisPrice: parseFloat(nhisPrice) || (basePriceNum * 0.1),
          corporatePrice: parseFloat(corporatePrice) || (basePriceNum * 2),
          isActive: isActive !== undefined ? isActive : true
        }
      });
      
      res.status(201).json(pricing);
    } catch (error) {
      console.error('POST /api/pricing error:', error);
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Service name already exists' });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // PUT update pricing service
  // ============================================================
  router.put('/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID format' });
      }
      
      const { name, description, category, basePrice, nhisPrice, corporatePrice, isActive } = req.body;
      
      const basePriceNum = parseFloat(basePrice) || 0;
      
      const pricing = await prisma.servicePricing.update({
        where: { id },
        data: {
          name,
          description: description || '',
          category: category || 'FPP',
          basePrice: basePriceNum,
          nhisPrice: parseFloat(nhisPrice) || (basePriceNum * 0.1),
          corporatePrice: parseFloat(corporatePrice) || (basePriceNum * 2),
          isActive: isActive !== undefined ? isActive : true
        }
      });
      
      res.json(pricing);
    } catch (error) {
      console.error('PUT /api/pricing/:id error:', error);
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Service name already exists' });
      }
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Service not found' });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // DELETE pricing service
  // ============================================================
  router.delete('/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID format' });
      }
      
      await prisma.servicePricing.delete({
        where: { id }
      });
      
      res.json({ message: 'Service deleted successfully' });
    } catch (error) {
      console.error('DELETE /api/pricing/:id error:', error);
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Service not found' });
      }
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};