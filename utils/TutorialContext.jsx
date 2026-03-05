import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';

const TutorialContext = createContext({});

const STORAGE_KEY = 'dogoods_tutorial_completed';
const PROGRESS_KEY = 'dogoods_tutorial_progress';

export const useTutorial = () => {
    const context = useContext(TutorialContext);
    if (!context) {
        throw new Error('useTutorial must be used within a TutorialProvider');
    }
    return context;
};

export const TutorialProvider = ({ children }) => {
    const [isTutorialOpen, setIsTutorialOpen] = useState(false);
    const [hasSeenTutorial, setHasSeenTutorial] = useState(false);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);

    useEffect(() => {
        const tutorialCompleted = localStorage.getItem(STORAGE_KEY);
        if (tutorialCompleted === 'true') {
            setHasSeenTutorial(true);
        }
    }, []);

    const startTutorial = useCallback(() => {
        setCurrentStepIndex(0);
        setIsTutorialOpen(true);
    }, []);

    const closeTutorial = useCallback(() => {
        setHasSeenTutorial(true);
        localStorage.setItem(STORAGE_KEY, 'true');
        setIsTutorialOpen(false);
        setCurrentStepIndex(0);
    }, []);

    const completeTutorial = useCallback(() => {
        setHasSeenTutorial(true);
        localStorage.setItem(STORAGE_KEY, 'true');
        setIsTutorialOpen(false);
        setCurrentStepIndex(0);
    }, []);

    const resetTutorial = useCallback(() => {
        setHasSeenTutorial(false);
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(PROGRESS_KEY);
        setCurrentStepIndex(0);
        setIsTutorialOpen(true);
    }, []);

    const goToStep = useCallback((index) => {
        setCurrentStepIndex(index);
    }, []);

    const nextStep = useCallback(() => {
        setCurrentStepIndex(prev => prev + 1);
    }, []);

    const prevStep = useCallback(() => {
        setCurrentStepIndex(prev => Math.max(0, prev - 1));
    }, []);

    const value = {
        isTutorialOpen,
        hasSeenTutorial,
        currentStepIndex,
        startTutorial,
        closeTutorial,
        completeTutorial,
        resetTutorial,
        goToStep,
        nextStep,
        prevStep,
    };

    return (
        <TutorialContext.Provider value={value}>
            {children}
        </TutorialContext.Provider>
    );
};

TutorialProvider.propTypes = {
    children: PropTypes.node.isRequired
};

export default TutorialContext;
