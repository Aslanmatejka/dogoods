import React from 'react';
import AdminLayout from './AdminLayout';
import supabase from '../../utils/supabaseClient';
import Button from '../../components/common/Button';

const ApprovalCodeManagement = () => {
    const [communities, setCommunities] = React.useState([]);
    const [codes, setCodes] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [generating, setGenerating] = React.useState(false);
    const [selectedCommunity, setSelectedCommunity] = React.useState('');
    const [quantity, setQuantity] = React.useState(50);
    const [schoolCode, setSchoolCode] = React.useState('');
    const [filterCommunity, setFilterCommunity] = React.useState('all');
    const [filterStatus, setFilterStatus] = React.useState('all');
    const [stats, setStats] = React.useState({ total: 0, claimed: 0, unclaimed: 0 });

    // School code mapping — 3-letter prefix for each community
    const SCHOOL_CODES = {
        'Do Good Warehouse': 'DGW',
        'Ruby Bridges Elementary CC': 'RBE',
        'NEA/ACLC CC': 'NEA',
        'Academy of Alameda CC': 'AOA',
        'Island HS CC': 'IHS',
        'Encinal Jr Sr High School': 'ENC',
        'Madison Park Academy Primary': 'MPP',
        'Alameda Unified School District': 'AUS',
        'Markham Elementary': 'MKE',
        'Madison Park Academy': 'MPA',
        'McClymonds High School': 'MCH',
        'Hillside Elementary School': 'HES',
        'Edendale Middle School': 'EDS',
        'San Lorenzo High School': 'SLH',
        'Garfield Elementary': 'GFE',
        'Lodestar Charter School': 'LCS',
        'Horace Mann Elementary': 'HME'
    };

    React.useEffect(() => {
        fetchCommunities();
        fetchCodes();
    }, []);

    React.useEffect(() => {
        // Auto-set school code when community is selected
        if (selectedCommunity) {
            const community = communities.find(c => String(c.id) === String(selectedCommunity));
            if (community && SCHOOL_CODES[community.name]) {
                setSchoolCode(SCHOOL_CODES[community.name]);
            } else {
                setSchoolCode('');
            }
        }
    }, [selectedCommunity, communities]);

    const fetchCommunities = async () => {
        try {
            const { data, error } = await supabase
                .from('communities')
                .select('id, name')
                .order('name', { ascending: true });

            if (error) throw error;
            setCommunities(data || []);
        } catch (error) {
            console.error('Error fetching communities:', error);
        }
    };

    const fetchCodes = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('approval_codes')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            const allCodes = data || [];
            setCodes(allCodes);

            // Calculate stats
            const total = allCodes.length;
            const claimed = allCodes.filter(c => c.is_claimed).length;
            setStats({ total, claimed, unclaimed: total - claimed });
        } catch (error) {
            console.error('Error fetching codes:', error);
            setCodes([]);
        } finally {
            setLoading(false);
        }
    };

    const generateCodes = async () => {
        if (!selectedCommunity || !schoolCode || quantity < 1) {
            alert('Please select a community, enter a school code, and specify quantity.');
            return;
        }

        if (!/^[A-Z]{3}$/.test(schoolCode.toUpperCase())) {
            alert('School code must be exactly 3 letters.');
            return;
        }

        setGenerating(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            const prefix = schoolCode.toUpperCase();

            // Fetch all existing codes for this prefix to avoid duplicates
            const { data: existingCodes } = await supabase
                .from('approval_codes')
                .select('code')
                .like('code', `${prefix}%`);

            const existingSet = new Set((existingCodes || []).map(c => c.code));

            // Generate batch of unique random 6-digit codes (100000–999999)
            const newCodes = [];
            const generated = new Set();
            let attempts = 0;
            const maxAttempts = quantity * 20;

            while (newCodes.length < quantity && attempts < maxAttempts) {
                attempts++;
                // Cryptographically random number in range [100000, 999999]
                const rand = 100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000);
                const num = String(rand).padStart(6, '0');
                const code = `${prefix}${num}`;
                if (!existingSet.has(code) && !generated.has(code)) {
                    generated.add(code);
                    newCodes.push({
                        code,
                        school_code: prefix,
                        community_id: parseInt(selectedCommunity, 10) || selectedCommunity,
                        is_claimed: false,
                        created_by: user?.id || null
                    });
                }
            }

            if (newCodes.length < quantity) {
                alert(`Could only generate ${newCodes.length} unique codes (requested ${quantity}). Try again or reduce the quantity.`);
                if (newCodes.length === 0) return;
            }

            // Insert in batches of 100
            for (let i = 0; i < newCodes.length; i += 100) {
                const batch = newCodes.slice(i, i + 100);
                const { error } = await supabase
                    .from('approval_codes')
                    .insert(batch);
                if (error) throw error;
            }

            alert(`Successfully generated ${quantity} approval codes for ${prefix}!`);
            fetchCodes();
        } catch (error) {
            console.error('Error generating codes:', error);
            alert(`Error generating codes: ${error.message}`);
        } finally {
            setGenerating(false);
        }
    };

    const exportCSV = () => {
        // Filter to unclaimed codes, sorted by school
        const unclaimedCodes = codes
            .filter(c => !c.is_claimed)
            .sort((a, b) => {
                if (a.school_code !== b.school_code) return a.school_code.localeCompare(b.school_code);
                return a.code.localeCompare(b.code);
            });

        const communityMap = {};
        communities.forEach(c => { communityMap[c.id] = c.name; });

        const csvRows = [
            ['Code', 'School Code', 'Community', 'Created At'].join(',')
        ];

        unclaimedCodes.forEach(c => {
            csvRows.push([
                c.code,
                c.school_code,
                `"${communityMap[c.community_id] || 'Unknown'}"`,
                c.created_at ? new Date(c.created_at).toLocaleDateString() : ''
            ].join(','));
        });

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `unused_approval_codes_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    };

    // Filter codes for display
    const filteredCodes = React.useMemo(() => {
        return codes.filter(code => {
            if (filterCommunity !== 'all' && String(code.community_id) !== String(filterCommunity)) return false;
            if (filterStatus === 'claimed' && !code.is_claimed) return false;
            if (filterStatus === 'unclaimed' && code.is_claimed) return false;
            return true;
        });
    }, [codes, filterCommunity, filterStatus]);

    // Per-school stats
    const schoolStats = React.useMemo(() => {
        const communityMap = {};
        communities.forEach(c => { communityMap[c.id] = c.name; });

        const statsMap = {};
        codes.forEach(code => {
            const schoolName = communityMap[code.community_id] || code.school_code;
            if (!statsMap[schoolName]) {
                statsMap[schoolName] = { total: 0, claimed: 0, unclaimed: 0, school_code: code.school_code };
            }
            statsMap[schoolName].total++;
            if (code.is_claimed) statsMap[schoolName].claimed++;
            else statsMap[schoolName].unclaimed++;
        });

        return Object.entries(statsMap).sort(([a], [b]) => a.localeCompare(b));
    }, [codes, communities]);

    return (
        <AdminLayout active="approval-codes">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Approval Code Management</h1>
                        <p className="text-gray-600 mt-1">Generate and manage school approval codes for family signups</p>
                    </div>
                    <Button
                        onClick={exportCSV}
                        variant="secondary"
                        icon={<i className="fas fa-download" aria-hidden="true"></i>}
                        disabled={codes.filter(c => !c.is_claimed).length === 0}
                    >
                        Export Unused Codes (CSV)
                    </Button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-lg shadow-sm p-5 border-l-4 border-blue-500">
                        <div className="text-sm text-gray-500">Total Codes</div>
                        <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                    </div>
                    <div className="bg-white rounded-lg shadow-sm p-5 border-l-4 border-primary-500">
                        <div className="text-sm text-gray-500">Claimed</div>
                        <div className="text-2xl font-bold text-primary-600">{stats.claimed}</div>
                    </div>
                    <div className="bg-white rounded-lg shadow-sm p-5 border-l-4 border-yellow-500">
                        <div className="text-sm text-gray-500">Available (Unclaimed)</div>
                        <div className="text-2xl font-bold text-yellow-600">{stats.unclaimed}</div>
                    </div>
                </div>

                {/* Per-School Stats */}
                {schoolStats.length > 0 && (
                    <div className="bg-white rounded-lg shadow-sm p-5">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">Codes by School</h2>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200">
                                        <th className="text-left py-2 px-3 font-medium text-gray-600">School</th>
                                        <th className="text-left py-2 px-3 font-medium text-gray-600">Prefix</th>
                                        <th className="text-right py-2 px-3 font-medium text-gray-600">Total</th>
                                        <th className="text-right py-2 px-3 font-medium text-gray-600">Claimed</th>
                                        <th className="text-right py-2 px-3 font-medium text-gray-600">Available</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {schoolStats.map(([name, s]) => (
                                        <tr key={name} className="border-b border-gray-100 hover:bg-gray-50">
                                            <td className="py-2 px-3">{name}</td>
                                            <td className="py-2 px-3 font-mono">{s.school_code}</td>
                                            <td className="py-2 px-3 text-right">{s.total}</td>
                                            <td className="py-2 px-3 text-right text-primary-600">{s.claimed}</td>
                                            <td className="py-2 px-3 text-right text-yellow-600">{s.unclaimed}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Generate Codes Section */}
                <div className="bg-white rounded-lg shadow-sm p-5">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Generate New Codes</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                School / Community <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={selectedCommunity}
                                onChange={(e) => setSelectedCommunity(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                                <option value="">Select school...</option>
                                {communities.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                School Code (3 letters) <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                maxLength={3}
                                value={schoolCode}
                                onChange={(e) => setSchoolCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono uppercase"
                                placeholder="e.g. RBE"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Quantity <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={1000}
                                value={quantity}
                                onChange={(e) => setQuantity(Math.min(1000, Math.max(1, parseInt(e.target.value) || 1)))}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        <div>
                            <Button
                                onClick={generateCodes}
                                variant="primary"
                                disabled={generating || !selectedCommunity || !schoolCode}
                                icon={generating ? <i className="fas fa-spinner fa-spin" aria-hidden="true"></i> : <i className="fas fa-plus-circle" aria-hidden="true"></i>}
                            >
                                {generating ? 'Generating...' : 'Generate Codes'}
                            </Button>
                        </div>
                    </div>
                    {selectedCommunity && schoolCode && (
                        <p className="mt-2 text-sm text-gray-500">
                            Codes will be generated as: <span className="font-mono font-semibold">{schoolCode}XXXXXX</span> (e.g. {schoolCode}100001)
                        </p>
                    )}
                </div>

                {/* Codes Table */}
                <div className="bg-white rounded-lg shadow-sm p-5">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                        <h2 className="text-lg font-semibold text-gray-900">
                            All Codes ({filteredCodes.length})
                        </h2>
                        <div className="flex flex-wrap gap-3">
                            <select
                                value={filterCommunity}
                                onChange={(e) => setFilterCommunity(e.target.value)}
                                className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                                <option value="all">All Schools</option>
                                {communities.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                                <option value="all">All Status</option>
                                <option value="unclaimed">Unclaimed</option>
                                <option value="claimed">Claimed</option>
                            </select>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-10">
                            <i className="fas fa-spinner fa-spin text-2xl text-gray-400" aria-hidden="true"></i>
                        </div>
                    ) : filteredCodes.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">
                            <i className="fas fa-key text-4xl mb-3" aria-hidden="true"></i>
                            <p>No approval codes found. Generate some codes above to get started.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200">
                                        <th className="text-left py-2 px-3 font-medium text-gray-600">Code</th>
                                        <th className="text-left py-2 px-3 font-medium text-gray-600">School</th>
                                        <th className="text-left py-2 px-3 font-medium text-gray-600">Status</th>
                                        <th className="text-left py-2 px-3 font-medium text-gray-600">Claimed At</th>
                                        <th className="text-left py-2 px-3 font-medium text-gray-600">Created</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredCodes.slice(0, 200).map(code => {
                                        const community = communities.find(c => String(c.id) === String(code.community_id));
                                        return (
                                            <tr key={code.id} className="border-b border-gray-100 hover:bg-gray-50">
                                                <td className="py-2 px-3 font-mono font-semibold">{code.code}</td>
                                                <td className="py-2 px-3">{community?.name || code.school_code}</td>
                                                <td className="py-2 px-3">
                                                    {code.is_claimed ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                                                            <i className="fas fa-check-circle mr-1" aria-hidden="true"></i>
                                                            Claimed
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                            <i className="fas fa-clock mr-1" aria-hidden="true"></i>
                                                            Available
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-2 px-3 text-gray-500">
                                                    {code.claimed_at ? new Date(code.claimed_at).toLocaleDateString() : '—'}
                                                </td>
                                                <td className="py-2 px-3 text-gray-500">
                                                    {code.created_at ? new Date(code.created_at).toLocaleDateString() : '—'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {filteredCodes.length > 200 && (
                                <p className="text-center text-sm text-gray-500 mt-3">
                                    Showing first 200 of {filteredCodes.length} codes. Use filters to narrow results or export CSV for full list.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
};

export default ApprovalCodeManagement;
