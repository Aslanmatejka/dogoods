import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from './AdminLayout';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import supabase from '../../utils/supabaseClient';
import { useAuthContext } from '../../utils/AuthContext';
import { toast } from 'react-toastify';

const CATEGORIES = [
    { value: '', label: 'Select category' },
    { value: 'produce', label: 'Fresh Produce' },
    { value: 'dairy', label: 'Dairy' },
    { value: 'bakery', label: 'Bakery' },
    { value: 'pantry', label: 'Pantry Items' },
    { value: 'meat', label: 'Meat & Poultry' },
    { value: 'seafood', label: 'Seafood' },
    { value: 'frozen', label: 'Frozen' },
    { value: 'snacks', label: 'Snacks' },
    { value: 'beverages', label: 'Beverages' },
    { value: 'prepared', label: 'Prepared Foods' }
];

const UNITS = [
    { value: 'lb', label: 'Pounds (lb)' },
    { value: 'oz', label: 'Ounces (oz)' },
    { value: 'kg', label: 'Kilograms (kg)' },
    { value: 'g', label: 'Grams (g)' },
    { value: 'count', label: 'Count/Items' },
    { value: 'serving', label: 'Servings' }
];

const INITIAL_FORM = {
    title: '',
    description: '',
    quantity: '',
    unit: 'lb',
    category: '',
    expiry_date: '',
    pickup_by: '',
    community_id: '',
    donor_name: 'DoGoods Admin',
    donor_type: 'organization',
    status: 'active',
    dietary_tags: [],
    allergens: [],
    ingredients: '',
    image: null,
};

// Helper: REST call that bypasses Supabase JS client auth
async function supabaseRest(path, method, body = null, extraHeaders = {}) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    let accessToken = supabaseKey;
    try {
        const sessionData = JSON.parse(localStorage.getItem('sb-ifzbpqyuhnxbhdcnmvfs-auth-token') || '{}');
        if (sessionData?.access_token) accessToken = sessionData.access_token;
    } catch (e) { /* use anon key */ }

    const headers = {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${accessToken}`,
        ...extraHeaders,
    };

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    opts.signal = controller.signal;

    const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, opts);
    clearTimeout(timeout);

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`${method} ${path} failed: ${response.status} - ${errText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        return response.json();
    }
    return null;
}

export default function AdminShareFood() {
    const { user } = useAuthContext();
    const [communities, setCommunities] = useState([]);
    const [listings, setListings] = useState([]);
    const [loadingCommunities, setLoadingCommunities] = useState(true);
    const [loadingListings, setLoadingListings] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({ ...INITIAL_FORM });
    const [errors, setErrors] = useState({});
    const [imagePreview, setImagePreview] = useState(null);
    const [filterCommunity, setFilterCommunity] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
    const [activeTab, setActiveTab] = useState('create'); // 'create' | 'manage'

    // Fetch communities
    useEffect(() => {
        const fetchCommunities = async () => {
            try {
                const { data, error } = await supabase
                    .from('communities')
                    .select('id, name')
                    .eq('is_active', true)
                    .order('name');
                if (error) throw error;
                setCommunities(data || []);
            } catch (err) {
                console.error('Error fetching communities:', err);
                toast.error('Failed to load communities');
            } finally {
                setLoadingCommunities(false);
            }
        };
        fetchCommunities();
    }, []);

    // Fetch listings
    const fetchListings = useCallback(async () => {
        setLoadingListings(true);
        try {
            let filter = 'select=*,users:user_id(id,name)&order=created_at.desc&limit=100';
            if (filterCommunity) {
                filter += `&community_id=eq.${filterCommunity}`;
            }
            const data = await supabaseRest(`food_listings?${filter}`, 'GET', null, { 'Prefer': '' });
            setListings(data || []);
        } catch (err) {
            console.error('Error fetching listings:', err);
            toast.error('Failed to load listings');
        } finally {
            setLoadingListings(false);
        }
    }, [filterCommunity]);

    useEffect(() => {
        fetchListings();
    }, [fetchListings]);

    // Form handlers
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (type === 'checkbox' && (name === 'dietary_tags' || name === 'allergens')) {
            setFormData(prev => ({
                ...prev,
                [name]: checked
                    ? [...prev[name], value]
                    : prev[name].filter(item => item !== value)
            }));
        } else if (type === 'number') {
            const numValue = value === '' ? '' : Number(value);
            if (numValue < 0) return;
            setFormData(prev => ({ ...prev, [name]: numValue }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            setErrors(prev => ({ ...prev, image: 'Image must be less than 5MB' }));
            return;
        }
        if (imagePreview) URL.revokeObjectURL(imagePreview);
        setImagePreview(URL.createObjectURL(file));
        setFormData(prev => ({ ...prev, image: file }));
        setErrors(prev => ({ ...prev, image: null }));
    };

    const validate = () => {
        const errs = {};
        if (!formData.title.trim()) errs.title = 'Title is required';
        if (!formData.quantity) errs.quantity = 'Quantity is required';
        if (!formData.category) errs.category = 'Category is required';
        if (!formData.community_id) errs.community_id = 'Community is required';
        if (!formData.description.trim()) errs.description = 'Description is required';
        if (formData.category !== 'produce' && !formData.expiry_date) errs.expiry_date = 'Expiry date is required for non-produce';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const uploadImage = async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const { error } = await supabase.storage.from('food-images').upload(fileName, file);
        if (error) throw error;
        const { data } = supabase.storage.from('food-images').getPublicUrl(fileName);
        return data?.publicUrl || null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;
        setSubmitting(true);
        try {
            // Upload image if provided
            let imageUrl = formData.image_url || null;
            if (formData.image instanceof File) {
                imageUrl = await uploadImage(formData.image);
            }

            const community = communities.find(c => String(c.id) === String(formData.community_id));

            const listing = {
                title: formData.title,
                description: formData.description,
                quantity: formData.quantity,
                unit: formData.unit,
                category: formData.category,
                expiry_date: formData.expiry_date || null,
                pickup_by: formData.pickup_by || null,
                status: 'active',
                listing_type: 'donation',
                user_id: user?.id || null,
                image_url: imageUrl,
                donor_name: formData.donor_name || 'DoGoods Admin',
                donor_type: formData.donor_type || 'organization',
                community_id: formData.community_id || null,
                dietary_tags: formData.dietary_tags || [],
                allergens: formData.allergens || [],
                ingredients: formData.ingredients || null,
            };

            if (editingId) {
                await supabaseRest(
                    `food_listings?id=eq.${editingId}`,
                    'PATCH',
                    listing,
                    { 'Prefer': 'return=minimal' }
                );
                toast.success(`Listing updated for ${community?.name || 'community'}`);
            } else {
                await supabaseRest(
                    'food_listings',
                    'POST',
                    listing,
                    { 'Prefer': 'return=minimal' }
                );
                toast.success(`Food shared to ${community?.name || 'community'}!`);
            }

            // Reset
            setFormData({ ...INITIAL_FORM });
            setImagePreview(null);
            setEditingId(null);
            setErrors({});
            fetchListings();
        } catch (err) {
            console.error('Submit error:', err);
            toast.error(err.message || 'Failed to save listing');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (listing) => {
        setFormData({
            title: listing.title || '',
            description: listing.description || '',
            quantity: listing.quantity || '',
            unit: listing.unit || 'lb',
            category: listing.category || '',
            expiry_date: listing.expiry_date || '',
            pickup_by: listing.pickup_by || '',
            community_id: listing.community_id || '',
            donor_name: listing.donor_name || 'DoGoods Admin',
            donor_type: listing.donor_type || 'organization',
            status: listing.status || 'active',
            dietary_tags: listing.dietary_tags || [],
            allergens: listing.allergens || [],
            ingredients: listing.ingredients || '',
            image: null,
            image_url: listing.image_url || null,
        });
        setEditingId(listing.id);
        setImagePreview(listing.image_url || null);
        setActiveTab('create');
        window.scrollTo(0, 0);
    };

    const handleDelete = async (id) => {
        try {
            await supabaseRest(`food_listings?id=eq.${id}`, 'DELETE', null, { 'Prefer': 'return=minimal' });
            toast.success('Listing deleted');
            setShowDeleteConfirm(null);
            fetchListings();
        } catch (err) {
            console.error('Delete error:', err);
            toast.error('Failed to delete listing');
        }
    };

    const handleStatusToggle = async (listing) => {
        const newStatus = listing.status === 'active' ? 'inactive' : 'active';
        try {
            await supabaseRest(
                `food_listings?id=eq.${listing.id}`,
                'PATCH',
                { status: newStatus },
                { 'Prefer': 'return=minimal' }
            );
            toast.success(`Listing ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
            fetchListings();
        } catch (err) {
            toast.error('Failed to update status');
        }
    };

    const communityName = (id) => {
        const c = communities.find(c => String(c.id) === String(id));
        return c?.name || 'Unknown';
    };

    return (
        <AdminLayout active="share-food">
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Share Food to Communities</h1>
                    <p className="text-gray-600 mt-1">Create and manage food listings for any community</p>
                </div>

                {/* Tabs */}
                <div className="border-b border-gray-200">
                    <nav className="flex space-x-8">
                        <button
                            onClick={() => { setActiveTab('create'); setEditingId(null); setFormData({ ...INITIAL_FORM }); setImagePreview(null); }}
                            className={`py-3 px-1 border-b-2 font-medium text-sm ${
                                activeTab === 'create'
                                    ? 'border-[#2CABE3] text-[#2CABE3]'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            <i className="fas fa-plus mr-2"></i>
                            {editingId ? 'Edit Listing' : 'Create Listing'}
                        </button>
                        <button
                            onClick={() => setActiveTab('manage')}
                            className={`py-3 px-1 border-b-2 font-medium text-sm ${
                                activeTab === 'manage'
                                    ? 'border-[#2CABE3] text-[#2CABE3]'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            <i className="fas fa-list mr-2"></i>
                            Manage Listings ({listings.length})
                        </button>
                    </nav>
                </div>

                {/* Create / Edit Tab */}
                {activeTab === 'create' && (
                    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-start">
                                <i className="fas fa-info-circle text-blue-500 mt-0.5 mr-3"></i>
                                <div>
                                    <h3 className="text-sm font-medium text-blue-800">Admin Food Sharing</h3>
                                    <p className="text-sm text-blue-700 mt-1">
                                        Listings created here are immediately active and visible to community members. Select a community to share food with.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Community Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Community <span className="text-red-500">*</span>
                            </label>
                            {loadingCommunities ? (
                                <div className="animate-pulse h-10 bg-gray-200 rounded"></div>
                            ) : (
                                <select
                                    name="community_id"
                                    value={formData.community_id}
                                    onChange={handleChange}
                                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#2CABE3] focus:border-transparent ${
                                        errors.community_id ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                >
                                    <option value="">Select a community</option>
                                    {communities.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            )}
                            {errors.community_id && <p className="mt-1 text-sm text-red-500">{errors.community_id}</p>}
                        </div>

                        {/* Food Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input
                                label="Food Title"
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                error={errors.title}
                                required
                                maxLength={100}
                                placeholder="e.g., Fresh Organic Apples"
                            />

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Category <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="category"
                                    value={formData.category}
                                    onChange={handleChange}
                                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#2CABE3] focus:border-transparent ${
                                        errors.category ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                >
                                    {CATEGORIES.map(c => (
                                        <option key={c.value} value={c.value}>{c.label}</option>
                                    ))}
                                </select>
                                {errors.category && <p className="mt-1 text-sm text-red-500">{errors.category}</p>}
                            </div>

                            <div className="md:col-span-2">
                                <Input
                                    label="Description"
                                    name="description"
                                    type="textarea"
                                    value={formData.description}
                                    onChange={handleChange}
                                    error={errors.description}
                                    required
                                    maxLength={500}
                                    placeholder="Describe the food, condition, and any pickup details"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Quantity <span className="text-red-500">*</span>
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        name="quantity"
                                        value={formData.quantity}
                                        onChange={handleChange}
                                        min="0"
                                        step="0.01"
                                        className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#2CABE3] focus:border-transparent ${
                                            errors.quantity ? 'border-red-500' : 'border-gray-300'
                                        }`}
                                        placeholder="Amount"
                                    />
                                    <select
                                        name="unit"
                                        value={formData.unit}
                                        onChange={handleChange}
                                        className="w-36 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2CABE3] focus:border-transparent"
                                    >
                                        {UNITS.map(u => (
                                            <option key={u.value} value={u.value}>{u.label}</option>
                                        ))}
                                    </select>
                                </div>
                                {errors.quantity && <p className="mt-1 text-sm text-red-500">{errors.quantity}</p>}
                            </div>

                            {formData.category !== 'produce' && (
                                <Input
                                    label="Expiration Date"
                                    name="expiry_date"
                                    type="date"
                                    value={formData.expiry_date}
                                    onChange={handleChange}
                                    error={errors.expiry_date}
                                    min={new Date().toISOString().split('T')[0]}
                                />
                            )}

                            <Input
                                label="Pickup Deadline (Optional)"
                                name="pickup_by"
                                type="datetime-local"
                                value={formData.pickup_by}
                                onChange={handleChange}
                                min={new Date().toISOString().slice(0, 16)}
                            />

                            <Input
                                label="Donor Name"
                                name="donor_name"
                                value={formData.donor_name}
                                onChange={handleChange}
                                maxLength={100}
                                placeholder="DoGoods Admin"
                            />
                        </div>

                        {/* Dietary Tags */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Dietary Information (Optional)</label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                    { value: 'vegetarian', label: 'Vegetarian', icon: '🥬' },
                                    { value: 'vegan', label: 'Vegan', icon: '🌱' },
                                    { value: 'gluten-free', label: 'Gluten-Free', icon: '🌾' },
                                    { value: 'dairy-free', label: 'Dairy-Free', icon: '🥛' },
                                    { value: 'nut-free', label: 'Nut-Free', icon: '🥜' },
                                    { value: 'halal', label: 'Halal', icon: '☪️' },
                                    { value: 'kosher', label: 'Kosher', icon: '✡️' },
                                    { value: 'organic', label: 'Organic', icon: '♻️' }
                                ].map(tag => (
                                    <label key={tag.value} className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            name="dietary_tags"
                                            value={tag.value}
                                            checked={formData.dietary_tags.includes(tag.value)}
                                            onChange={handleChange}
                                            className="w-4 h-4 text-[#2CABE3] border-gray-300 rounded focus:ring-[#2CABE3]"
                                        />
                                        <span className="text-sm text-gray-700">{tag.icon} {tag.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Image */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Photo (Optional for admin)</label>
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/gif"
                                onChange={handleImageChange}
                                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#2CABE3]/10 file:text-[#2CABE3] hover:file:bg-[#2CABE3]/20"
                            />
                            {errors.image && <p className="mt-1 text-sm text-red-500">{errors.image}</p>}
                            {imagePreview && (
                                <img src={imagePreview} alt="Preview" className="mt-2 h-32 w-32 object-cover rounded-lg border" />
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end space-x-3 pt-4 border-t">
                            {editingId && (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => { setEditingId(null); setFormData({ ...INITIAL_FORM }); setImagePreview(null); setErrors({}); }}
                                >
                                    Cancel Edit
                                </Button>
                            )}
                            <Button type="submit" disabled={submitting}>
                                {submitting ? (
                                    <span className="flex items-center">
                                        <i className="fas fa-spinner fa-spin mr-2"></i>
                                        {editingId ? 'Updating...' : 'Sharing...'}
                                    </span>
                                ) : (
                                    <span>
                                        <i className={`fas ${editingId ? 'fa-save' : 'fa-share-alt'} mr-2`}></i>
                                        {editingId ? 'Update Listing' : 'Share Food'}
                                    </span>
                                )}
                            </Button>
                        </div>
                    </form>
                )}

                {/* Manage Tab */}
                {activeTab === 'manage' && (
                    <div className="space-y-4">
                        {/* Filter by community */}
                        <div className="bg-white rounded-lg shadow p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Filter by Community:</label>
                                <select
                                    value={filterCommunity}
                                    onChange={(e) => setFilterCommunity(e.target.value)}
                                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2CABE3] focus:border-transparent"
                                >
                                    <option value="">All Communities</option>
                                    {communities.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                                <span className="text-sm text-gray-500">{listings.length} listing{listings.length !== 1 ? 's' : ''}</span>
                            </div>
                        </div>

                        {loadingListings ? (
                            <div className="flex justify-center py-12">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#2CABE3]"></div>
                            </div>
                        ) : listings.length === 0 ? (
                            <div className="bg-white rounded-lg shadow p-12 text-center">
                                <i className="fas fa-box-open text-gray-400 text-4xl mb-4"></i>
                                <p className="text-gray-600">No food listings found</p>
                                <Button className="mt-4" onClick={() => setActiveTab('create')}>
                                    <i className="fas fa-plus mr-2"></i>Create One
                                </Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {listings.map(listing => (
                                    <div key={listing.id} className="bg-white rounded-lg shadow overflow-hidden relative">
                                        {listing.image_url && (
                                            <img src={listing.image_url} alt={listing.title} className="w-full h-40 object-cover" />
                                        )}
                                        {!listing.image_url && (
                                            <div className="w-full h-40 bg-gray-100 flex items-center justify-center">
                                                <i className="fas fa-image text-gray-300 text-4xl"></i>
                                            </div>
                                        )}
                                        <div className="p-4">
                                            <div className="flex justify-between items-start mb-1">
                                                <h3 className="font-semibold text-gray-900 truncate flex-1">{listing.title}</h3>
                                                <span className={`ml-2 px-2 py-0.5 text-xs rounded-full whitespace-nowrap ${
                                                    listing.status === 'active'
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : listing.status === 'pending'
                                                        ? 'bg-yellow-100 text-yellow-800'
                                                        : 'bg-gray-100 text-gray-800'
                                                }`}>
                                                    {listing.status}
                                                </span>
                                            </div>
                                            <p className="text-xs text-[#2CABE3] font-medium mb-2">
                                                <i className="fas fa-users mr-1"></i>
                                                {listing.community_id ? communityName(listing.community_id) : 'No community'}
                                            </p>
                                            <p className="text-sm text-gray-600 line-clamp-2 mb-3">{listing.description}</p>
                                            <div className="flex items-center text-xs text-gray-500 mb-3">
                                                <span className="mr-3"><i className="fas fa-weight-hanging mr-1"></i>{listing.quantity} {listing.unit}</span>
                                                <span className="capitalize"><i className="fas fa-tag mr-1"></i>{listing.category}</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleEdit(listing)}
                                                    className="flex-1 px-3 py-1.5 text-xs font-medium text-[#2CABE3] border border-[#2CABE3] rounded-lg hover:bg-[#2CABE3]/10 transition"
                                                >
                                                    <i className="fas fa-edit mr-1"></i>Edit
                                                </button>
                                                <button
                                                    onClick={() => handleStatusToggle(listing)}
                                                    className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                                                        listing.status === 'active'
                                                            ? 'text-yellow-700 border border-yellow-400 hover:bg-yellow-50'
                                                            : 'text-emerald-700 border border-emerald-400 hover:bg-emerald-50'
                                                    }`}
                                                >
                                                    <i className={`fas ${listing.status === 'active' ? 'fa-pause' : 'fa-play'} mr-1`}></i>
                                                    {listing.status === 'active' ? 'Deactivate' : 'Activate'}
                                                </button>
                                                <button
                                                    onClick={() => setShowDeleteConfirm(listing.id)}
                                                    className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition"
                                                >
                                                    <i className="fas fa-trash"></i>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Delete Confirmation Overlay */}
                                        {showDeleteConfirm === listing.id && (
                                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-4 z-10">
                                                <div className="bg-white rounded-lg p-5 max-w-xs w-full text-center">
                                                    <i className="fas fa-exclamation-triangle text-red-500 text-2xl mb-3"></i>
                                                    <p className="text-gray-800 font-medium mb-1">Delete this listing?</p>
                                                    <p className="text-gray-500 text-sm mb-4">This cannot be undone.</p>
                                                    <div className="flex gap-3">
                                                        <button
                                                            onClick={() => setShowDeleteConfirm(null)}
                                                            className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(listing.id)}
                                                            className="flex-1 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
