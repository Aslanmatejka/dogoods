import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import supabase from '../utils/supabaseClient';
import { reportError } from '../utils/helpers';
import { useAuthContext } from '../utils/AuthContext';

function NewsPage() {
    const { isAdmin } = useAuthContext();
    const navigate = useNavigate();
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalImage, setModalImage] = useState(null);

    useEffect(() => {
        loadNews();
    }, []);

    const loadNews = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('impact_stories')
                .select('*')
                .eq('type', 'news')
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error loading news:', error);
                reportError(error, { context: 'News page load' });
            }
            setNews(data || []);
        } catch (error) {
            console.error('Error loading news:', error);
            reportError(error, { context: 'News page load' });
        } finally {
            setLoading(false);
        }
    };

    const handleImageClick = (image, title, description) => {
        setModalImage({ image, title, description });
    };

    const closeModal = () => {
        setModalImage(null);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <style>{`
                .clickable-image {
                    cursor: pointer;
                    transition: transform 0.3s ease;
                    position: relative;
                    overflow: hidden;
                    border-radius: 1rem 1rem 0 0;
                }
                .clickable-image:hover {
                    transform: scale(1.02);
                }
                .clickable-image::before {
                    content: '?? Click to view';
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: rgba(44, 171, 227, 0.95);
                    color: white;
                    padding: 10px 20px;
                    border-radius: 12px;
                    font-size: 14px;
                    font-weight: 600;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                    pointer-events: none;
                    z-index: 10;
                }
                .clickable-image:hover::before {
                    opacity: 1;
                }
                .clickable-image img {
                    transition: filter 0.3s ease;
                }
                .clickable-image:hover img {
                    filter: brightness(0.9);
                }
                @keyframes riseUp {
                    from { opacity: 0; transform: translateY(40px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .rise-up { opacity: 0; animation: riseUp 0.6s ease-out forwards; }
            `}</style>

            {/* Image Modal */}
            {modalImage && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
                    onClick={closeModal}
                >
                    <div
                        className="relative bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={closeModal}
                            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 bg-white rounded-full p-2 shadow-lg z-10"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <img
                            src={modalImage.image}
                            alt={modalImage.title}
                            className="w-full h-auto rounded-t-2xl"
                        />
                        <div className="p-8">
                            <h2 className="text-3xl font-bold text-gray-900 mb-4">{modalImage.title}</h2>
                            <p className="text-lg text-gray-700 leading-relaxed">{modalImage.description}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Admin Manage Button */}
            {isAdmin && (
                <button
                    onClick={() => navigate('/admin/impact-content')}
                    className="fixed bottom-8 right-8 z-40 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-full font-semibold shadow-2xl hover:shadow-xl transition-all transform hover:scale-105"
                >
                    ?? Manage Content
                </button>
            )}

            {/* Hero Section */}
            <section className="bg-gradient-to-br from-blue-50 to-indigo-100 py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center">
                        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
                            DoGoods News &amp; Updates
                        </h1>
                        <p className="text-xl text-gray-700 max-w-3xl mx-auto mb-8">
                            Stay informed about our latest milestones, partnerships, and community impact in the fight against food waste.
                        </p>
                        <div className="flex justify-center gap-4 md:gap-8 flex-wrap">
                            <Link to="/impact-story" className="bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-[#2CABE3] hover:text-white transition-all">
                                Impact Story
                            </Link>
                            <Link to="/impact-story" onClick={(e) => { e.preventDefault(); navigate('/impact-story'); setTimeout(() => document.getElementById('blog-section')?.scrollIntoView({ behavior: 'smooth' }), 300); }} className="bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-[#2CABE3] hover:text-white transition-all">
                                Blog
                            </Link>
                            <span className="bg-[#2CABE3] text-white px-6 py-3 rounded-xl font-semibold shadow-md cursor-default">
                                News
                            </span>
                            <Link to="/testimonials" className="bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-[#2CABE3] hover:text-white transition-all">
                                Testimonials
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* News Articles */}
            <section className="py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {news.length === 0 ? (
                        <div className="text-center py-16">
                            <p className="text-gray-500 text-lg">No news articles yet. Check back soon!</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-8 max-w-4xl mx-auto">
                            {news.map((item, index) => (
                                <div
                                    key={item.id}
                                    className="rise-up bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col md:flex-row"
                                    style={{ animationDelay: `${index * 0.12}s` }}
                                >
                                    {item.image_url && (
                                        <div
                                            className="clickable-image md:w-80 shrink-0 !rounded-none md:!rounded-l-2xl"
                                            onClick={() => handleImageClick(item.image_url, item.title, item.quote || item.description)}
                                        >
                                            <img
                                                src={item.image_url}
                                                alt={item.title}
                                                className="w-full h-52 md:h-full object-cover"
                                                onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1504711434969-e33886168d6c?q=80&w=800&auto=format&fit=crop'; }}
                                            />
                                        </div>
                                    )}
                                    <div className="p-6 flex flex-col justify-center">
                                        <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide font-medium">
                                            {new Date(item.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                                        </p>
                                        <h3 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h3>
                                        <p className="text-gray-600 leading-relaxed line-clamp-3 text-sm">{item.quote || item.description}</p>
                                        {item.attribution && (
                                            <p className="text-sm text-gray-500 mt-3">� {item.attribution}{item.organization && `, ${item.organization}`}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-16 bg-gradient-to-br from-primary-50 to-primary-100">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-4xl font-bold text-gray-900 mb-6">Stay Connected</h2>
                    <p className="text-lg text-gray-700 mb-8">
                        Want to be the first to hear about our latest news and updates?
                    </p>
                    <Link
                        to="/impact-story"
                        className="inline-block bg-[#2CABE3] text-white px-8 py-4 rounded-xl font-bold text-lg hover:opacity-90 transition-all shadow-lg"
                    >
                        Subscribe to Newsletter
                    </Link>
                </div>
            </section>
        </div>
    );
}

export default NewsPage;
