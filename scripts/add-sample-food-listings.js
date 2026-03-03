// Script to add sample food listings with coordinates for testing the map
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials. Please check your .env.local file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const sampleListings = [
    {
        title: 'Fresh Organic Apples',
        description: 'Delicious organic apples from local farm, perfect condition',
        quantity: 10,
        unit: 'lb',
        category: 'produce',
        status: 'approved',
        latitude: 40.7128,
        longitude: -74.0060,
        donor_name: 'NYC Community Garden',
        donor_email: 'garden@example.com',
        image_url: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=400'
    },
    {
        title: 'Whole Wheat Bread',
        description: 'Freshly baked whole wheat bread, made this morning',
        quantity: 5,
        unit: 'loaves',
        category: 'bakery',
        status: 'approved',
        latitude: 34.0522,
        longitude: -118.2437,
        donor_name: 'LA Bakery',
        donor_email: 'bakery@example.com',
        image_url: 'https://images.unsplash.com/photo-1608198093002-ad4e005484ec?w=400'
    },
    {
        title: 'Mixed Vegetables',
        description: 'Assorted fresh vegetables - carrots, broccoli, peppers',
        quantity: 15,
        unit: 'lb',
        category: 'produce',
        status: 'approved',
        latitude: 41.8781,
        longitude: -87.6298,
        donor_name: 'Chicago Farmers Market',
        donor_email: 'market@example.com',
        image_url: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=400'
    },
    {
        title: 'Canned Soup',
        description: 'Variety of canned soups, all unexpired',
        quantity: 20,
        unit: 'cans',
        category: 'canned',
        status: 'approved',
        latitude: 29.7604,
        longitude: -95.3698,
        donor_name: 'Houston Food Bank',
        donor_email: 'foodbank@example.com',
        image_url: 'https://images.unsplash.com/photo-1593759608892-b0033064e78c?w=400'
    },
    {
        title: 'Dairy Products',
        description: 'Milk, cheese, and yogurt - all fresh',
        quantity: 8,
        unit: 'items',
        category: 'dairy',
        status: 'approved',
        latitude: 33.4484,
        longitude: -112.0740,
        donor_name: 'Phoenix Dairy',
        donor_email: 'dairy@example.com',
        image_url: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=400'
    }
];

async function addSampleListings() {
    console.log('Adding sample food listings with coordinates...\n');

    for (const listing of sampleListings) {
        const { error } = await supabase
            .from('food_listings')
            .insert([listing])
            .select();

        if (error) {
            console.error(`❌ Error adding ${listing.title}:`, error.message);
        } else {
            console.log(`✅ Added: ${listing.title} at (${listing.latitude}, ${listing.longitude})`);
        }
    }

    console.log('\n✨ Sample listings added successfully!');
    console.log('You should now see markers on the map at these locations:');
    console.log('- New York City');
    console.log('- Los Angeles');
    console.log('- Chicago');
    console.log('- Houston');
    console.log('- Phoenix');
}

addSampleListings();
