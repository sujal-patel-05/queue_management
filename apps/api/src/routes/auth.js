import { supabase } from '../db/supabase.js';
import bcrypt from 'bcryptjs';

export default async function authRoutes(app) {

  // Staff login
  app.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 }
        }
      }
    }
  }, async (request, reply) => {
    const { email, password } = request.body;

    const { data: staff } = await supabase
      .from('staff')
      .select('*, restaurants(id, name, slug)')
      .eq('email', email.toLowerCase())
      .eq('is_active', true)
      .single();

    if (!staff) return reply.status(401).send({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, staff.password_hash);
    if (!valid) return reply.status(401).send({ error: 'Invalid credentials' });

    const token = app.jwt.sign({
      id: staff.id,
      email: staff.email,
      name: staff.name,
      role: staff.role,
      restaurant_id: staff.restaurant_id,
      restaurant_name: staff.restaurants?.name,
      restaurant_slug: staff.restaurants?.slug
    }, { expiresIn: '24h' });

    return {
      token,
      user: {
        id: staff.id,
        email: staff.email,
        name: staff.name,
        role: staff.role,
        restaurant_id: staff.restaurant_id,
        restaurant_name: staff.restaurants?.name,
        restaurant_slug: staff.restaurants?.slug
      }
    };
  });

  // Register new restaurant + owner (onboarding)
  app.post('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password', 'name', 'restaurant_name'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          name: { type: 'string' },
          restaurant_name: { type: 'string' },
          restaurant_slug: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    console.log('[DEBUG] Start register');
    const { email, password, name, restaurant_name, restaurant_slug } = request.body;

    // Check if email already exists
    console.log('[DEBUG] Checking if email exists...');
    const { data: existing } = await supabase
      .from('staff')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();
    
    console.log('[DEBUG] Checked email');
    if (existing) return reply.status(409).send({ error: 'Email already registered' });

    // Create slug
    const slug = restaurant_slug || restaurant_name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Create restaurant
    console.log('[DEBUG] Inserting restaurant...');
    const { data: restaurant, error: rError } = await supabase
      .from('restaurants')
      .insert({ name: restaurant_name, slug })
      .select()
      .single();

    console.log('[DEBUG] Inserted restaurant', rError);
    if (rError) return reply.status(500).send({ error: 'Failed to create restaurant: ' + rError.message });

    // Create default dine-in queue
    console.log('[DEBUG] Inserting queue...');
    await supabase.from('queues').insert({
      restaurant_id: restaurant.id,
      name: 'Dine-in',
      type: 'dine_in',
      description: 'Main dine-in queue'
    });
    console.log('[DEBUG] Inserted queue');

    // Hash password and create staff
    console.log('[DEBUG] Hashing password...');
    const password_hash = await bcrypt.hash(password, 12);

    const { data: staff, error: sError } = await supabase
      .from('staff')
      .insert({
        restaurant_id: restaurant.id,
        email: email.toLowerCase(),
        password_hash,
        name,
        role: 'owner'
      })
      .select()
      .single();

    if (sError) return reply.status(500).send({ error: 'Failed to create account' });

    const token = app.jwt.sign({
      id: staff.id,
      email: staff.email,
      name: staff.name,
      role: 'owner',
      restaurant_id: restaurant.id,
      restaurant_name: restaurant.name,
      restaurant_slug: restaurant.slug
    }, { expiresIn: '24h' });

    return {
      token,
      user: {
        id: staff.id,
        email: staff.email,
        name: staff.name,
        role: 'owner',
        restaurant_id: restaurant.id,
        restaurant_name: restaurant.name,
        restaurant_slug: restaurant.slug
      }
    };
  });

  // Add new staff member (STAFF/OWNER only)
  app.post('/add-staff', {
    preHandler: async (request, reply) => {
      try { await request.jwtVerify(); } catch { return reply.status(401).send({ error: 'Unauthorized' }); }
      if (request.user.role !== 'owner' && request.user.role !== 'manager') {
        return reply.status(403).send({ error: 'Only managers and owners can add staff' });
      }
    },
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password', 'name', 'role'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          name: { type: 'string' },
          role: { type: 'string', enum: ['staff', 'kitchen', 'manager'] }
        }
      }
    }
  }, async (request, reply) => {
    const { email, password, name, role } = request.body;
    
    // Check if email exists
    const { data: existing } = await supabase.from('staff').select('id').eq('email', email.toLowerCase()).single();
    if (existing) return reply.status(409).send({ error: 'Email already registered' });

    // Hash password and insert
    const password_hash = await bcrypt.hash(password, 12);
    const { data: newStaff, error } = await supabase
      .from('staff')
      .insert({
        restaurant_id: request.user.restaurant_id,
        email: email.toLowerCase(),
        password_hash,
        name,
        role
      })
      .select('id, email, name, role, created_at')
      .single();

    if (error) return reply.status(500).send({ error: 'Failed to add staff account' });
    return { success: true, staff: newStaff };
  });

  // Get current user profile
  app.get('/me', {
    preHandler: async (request, reply) => {
      try { await request.jwtVerify(); } catch { reply.status(401).send({ error: 'Unauthorized' }); }
    }
  }, async (request) => {
    const { data: staff } = await supabase
      .from('staff')
      .select('id, email, name, role, restaurant_id, restaurants(name, slug, logo_url)')
      .eq('id', request.user.id)
      .single();
    return { user: staff };
  });

  // Get all staff members for the restaurant
  app.get('/staff', {
    preHandler: async (request, reply) => {
      try { await request.jwtVerify(); } catch { return reply.status(401).send({ error: 'Unauthorized' }); }
    }
  }, async (request) => {
    const { data: staff } = await supabase
      .from('staff')
      .select('id, email, name, role, created_at')
      .eq('restaurant_id', request.user.restaurant_id)
      .order('created_at', { ascending: false });
    return { staff: staff || [] };
  });
}
