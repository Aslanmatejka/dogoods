import React from "react";
import Header from "../common/Header";
import Footer from "../common/Footer";
// import AssistantButton from "../assistant/AssistantButton";
// import AIAssistant from "../assistant/AIAssistant";
import UserChatWidget from "../common/UserChatWidget";
import Tutorial from "../common/Tutorial";
import { useTutorial } from "../../utils/TutorialContext";


function MainLayout({ children }) {
    // const [isAssistantOpen, setIsAssistantOpen] = React.useState(false);

    // const toggleAssistant = () => {
    //     setIsAssistantOpen(!isAssistantOpen);
    // };

    const { hasSeenTutorial, isTutorialOpen, startTutorial } = useTutorial();

    // Auto-start tutorial for first-time visitors (only on initial page load)
    React.useEffect(() => {
        if (!hasSeenTutorial && !isTutorialOpen) {
            const timer = setTimeout(() => {
                startTutorial();
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, []); // intentionally run only once on mount

    return (
        <div data-name="main-layout" className="min-h-screen flex flex-col bg-gradient-to-br from-cyan-50 via-white to-cyan-100">
            <Header/>
            <main className="flex-grow container mx-auto px-4 py-8">
                <div className="rounded-3xl shadow-2xl bg-white/80 backdrop-blur-md border border-cyan-100 p-6 md:p-10 transition-all duration-300">
                    {children}
                </div>
            </main>
            <Footer />

            {/* AI Assistant Button and Modal */}
            {/* <AssistantButton onClick={toggleAssistant} />
            {isAssistantOpen && (
                <AIAssistant
                    key="ai-assistant"
                    isOpen={isAssistantOpen}
                    onClose={() => setIsAssistantOpen(false)}
                />
            )} */}

            {/* User Chat Widget (for messaging admin) */}
            <UserChatWidget />

            {/* Global Tutorial Overlay */}
            <Tutorial />
        </div>
    );
}


export default MainLayout;
