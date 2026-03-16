import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import Button from '../components/common/Button';
import supabase from '../utils/supabaseClient';

function EmailConfirmationPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const email = location.state?.email || '';
    const [resending, setResending] = React.useState(false);
    const [resendSuccess, setResendSuccess] = React.useState(false);
    const [resendError, setResendError] = React.useState(null);
    const [cooldown, setCooldown] = React.useState(0);

    React.useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // Cooldown timer for resend button
    React.useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setInterval(() => {
            setCooldown(prev => prev - 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [cooldown]);

    // If no email was passed (direct navigation), redirect to signup
    React.useEffect(() => {
        if (!email) {
            navigate('/signup');
        }
    }, [email, navigate]);

    const handleResendEmail = async () => {
        if (cooldown > 0 || resending) return;

        setResending(true);
        setResendError(null);
        setResendSuccess(false);

        try {
            const siteUrl = window.location.origin;
            const { error } = await supabase.auth.resend({
                type: 'signup',
                email: email,
                options: {
                    emailRedirectTo: `${siteUrl}/login`
                }
            });

            if (error) {
                throw error;
            }

            setResendSuccess(true);
            setCooldown(60); // 60 second cooldown between resends
        } catch (error) {
            console.error('Resend confirmation error:', error);
            setResendError(error.message || 'Failed to resend confirmation email. Please try again.');
        } finally {
            setResending(false);
        }
    };

    if (!email) return null;

    return (
        <div className="min-h-screen bg-gradient-to-b from-primary-50 via-white to-primary-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-lg">
                <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg p-8 sm:p-10">
                    {/* Email Icon */}
                    <div className="text-center mb-6">
                        <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-primary-100 mb-6">
                            <i className="fas fa-envelope-open-text text-primary-600 text-3xl" aria-hidden="true"></i>
                        </div>

                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
                            Check your email
                        </h1>

                        <p className="text-gray-600 text-base leading-relaxed">
                            We&apos;ve sent a confirmation link to
                        </p>
                        <p className="text-primary-700 font-semibold text-lg mt-1 mb-4 break-all">
                            {email}
                        </p>

                        <p className="text-gray-500 text-sm leading-relaxed">
                            Click the link in the email to verify your account and get started with DoGoods.
                            The link will expire in 24 hours.
                        </p>

                        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-xs text-yellow-800">
                                <i className="fas fa-exclamation-triangle mr-1" aria-hidden="true"></i>
                                <strong>Not seeing the email?</strong> Check your spam/junk folder. 
                                The email comes from <strong>noreply@mail.app.supabase.io</strong>. 
                                If it&apos;s not there after a few minutes, click &ldquo;Resend&rdquo; below.
                            </p>
                        </div>
                    </div>

                    {/* Steps */}
                    <div className="bg-primary-50 rounded-xl p-5 mb-6">
                        <h2 className="text-sm font-semibold text-primary-800 mb-3">What to do next:</h2>
                        <ol className="space-y-3">
                            <li className="flex items-start gap-3">
                                <span className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-primary-200 text-primary-800 text-xs font-bold">1</span>
                                <span className="text-sm text-primary-700">Open your email inbox for <strong>{email}</strong></span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-primary-200 text-primary-800 text-xs font-bold">2</span>
                                <span className="text-sm text-primary-700">Look for an email from DoGoods (check spam/junk if needed)</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-primary-200 text-primary-800 text-xs font-bold">3</span>
                                <span className="text-sm text-primary-700">Click the <strong>&ldquo;Confirm your email&rdquo;</strong> link</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-primary-200 text-primary-800 text-xs font-bold">4</span>
                                <span className="text-sm text-primary-700">Once confirmed, sign in and start sharing food!</span>
                            </li>
                        </ol>
                    </div>

                    {/* Resend Section */}
                    <div className="text-center mb-6">
                        <p className="text-sm text-gray-500 mb-3">
                            Didn&apos;t receive the email?
                        </p>

                        {resendSuccess && (
                            <div className="mb-3 p-3 bg-primary-50 text-primary-700 rounded-lg text-sm" role="status">
                                <i className="fas fa-check-circle mr-2" aria-hidden="true"></i>
                                Confirmation email resent successfully!
                            </div>
                        )}

                        {resendError && (
                            <div className="mb-3 p-3 bg-red-50 text-red-700 rounded-lg text-sm" role="alert">
                                <i className="fas fa-exclamation-circle mr-2" aria-hidden="true"></i>
                                {resendError}
                            </div>
                        )}

                        <button
                            onClick={handleResendEmail}
                            disabled={resending || cooldown > 0}
                            className={`text-sm font-medium transition-colors ${
                                cooldown > 0
                                    ? 'text-gray-400 cursor-not-allowed'
                                    : 'text-primary-600 hover:text-primary-700 cursor-pointer'
                            }`}
                        >
                            {resending ? (
                                <>
                                    <i className="fas fa-spinner fa-spin mr-1" aria-hidden="true"></i>
                                    Sending...
                                </>
                            ) : cooldown > 0 ? (
                                `Resend available in ${cooldown}s`
                            ) : (
                                <>
                                    <i className="fas fa-redo mr-1" aria-hidden="true"></i>
                                    Resend confirmation email
                                </>
                            )}
                        </button>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-gray-200 pt-6">
                        <Button
                            variant="primary"
                            onClick={() => navigate('/login')}
                            className="w-full mb-3"
                        >
                            Go to Sign In
                        </Button>

                        <p className="text-center text-sm text-gray-500">
                            Wrong email?{' '}
                            <Link to="/signup" className="text-primary-600 hover:text-primary-700 font-medium">
                                Sign up again
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default EmailConfirmationPage;
