import { useState } from "react";
import {
    MessageCircle,
    X,
    ChevronRight,
    ArrowLeft,
    Search,
    HelpCircle,
} from "lucide-react";

import "../../styles/chatbot.css";

import {
    getChatbotCategories,
    getChatbotFAQs,
    searchChatbotFAQs,
} from "../../services/chatbotService";


// ============================================================
// FAQ CHATBOT
// ============================================================

export default function FAQChatbot() {

    const [isOpen, setIsOpen] = useState(false);

    const [categories, setCategories] = useState([]);
    const [faqs, setFaqs] = useState([]);

    const [selectedCategory, setSelectedCategory] =
        useState(null);

    const [selectedFAQ, setSelectedFAQ] =
        useState(null);

    const [searchQuery, setSearchQuery] =
        useState("");

    const [searchResults, setSearchResults] =
        useState([]);

    const [loading, setLoading] =
        useState(false);

    const [searching, setSearching] =
        useState(false);

    const [error, setError] =
        useState("");


    const loadCategories = async () => {

        try {

            setLoading(true);
            setError("");

            const response =
                await getChatbotCategories();

            setCategories(
                response?.data || []
            );

        }
        catch (error) {

            console.error(
                "Failed to load FAQ categories:",
                error
            );

            setError(
                "Unable to load help topics."
            );

        }
        finally {

            setLoading(false);

        }

    };


// ============================================================
// LOAD CATEGORY FAQs
// ============================================================

    const handleCategoryClick = async (category) => {

        try {

            setSelectedCategory(category);
            setSelectedFAQ(null);
            setLoading(true);
            setError("");

            const response =
                await getChatbotFAQs(category.id);

            setFaqs(
                response?.data || []
            );

        }
        catch (error) {

            console.error(
                "Failed to load FAQs:",
                error
            );

            setError(
                "Unable to load questions."
            );

        }
        finally {

            setLoading(false);

        }

    };


// ============================================================
// SEARCH
// ============================================================

    const handleSearch = async (event) => {

        event.preventDefault();

        const query =
            searchQuery.trim();

        if (!query) {

            setSearchResults([]);

            return;

        }

        try {

            setSearching(true);
            setError("");

            const response =
                await searchChatbotFAQs(query);

            setSearchResults(
                response?.data || []
            );

            setSelectedCategory(null);
            setSelectedFAQ(null);

        }
        catch (error) {

            console.error(
                "FAQ search failed:",
                error
            );

            setError(
                "Unable to search FAQs."
            );

        }
        finally {

            setSearching(false);

        }

    };


// ============================================================
// SELECT FAQ
// ============================================================

    const handleFAQClick = (faq) => {

        setSelectedFAQ(faq);

    };


// ============================================================
// BACK
// ============================================================

    const handleBack = () => {

        if (selectedFAQ) {

            setSelectedFAQ(null);

            return;

        }

        if (selectedCategory) {

            setSelectedCategory(null);
            setFaqs([]);

            return;

        }

        if (searchResults.length) {

            setSearchResults([]);

            return;

        }

    };


// ============================================================
// CLOSE
// ============================================================

    const handleClose = () => {

        setIsOpen(false);

        setSelectedCategory(null);
        setSelectedFAQ(null);
        setFaqs([]);
        setSearchResults([]);
        setSearchQuery("");
        setError("");

    };

    const openChatbot = () => {
        setIsOpen(true);
        loadCategories();
    };


// ============================================================
// CURRENT QUESTIONS
// ============================================================

    const currentFAQs =
        searchResults.length > 0
            ? searchResults
            : faqs;


// ============================================================
// RENDER
// ============================================================

    return (
        <>
            {/* ==================================================
                CHAT PANEL
            ================================================== */}

            {isOpen && (

                <div
                    className="customer-chatbot-panel"
                >

                    {/* ==========================================
                        HEADER
                    ========================================== */}

                    <div className="customer-chatbot-header">

                        <div
                            className="customer-chatbot-header-row"
                        >

                            <div
                                className="customer-chatbot-brand"
                            >

                                <div className="customer-chatbot-brand-icon">
                                    <HelpCircle
                                        size={21}
                                    />
                                </div>

                                <div className="customer-chatbot-brand-copy">

                                    <span className="customer-chatbot-eyebrow">
                                        AUMVEDA CARE
                                    </span>

                                    <div className="customer-chatbot-title">
                                        Aumveda Help
                                    </div>

                                    <div className="customer-chatbot-status">
                                        <span className="customer-chatbot-status-dot" />
                                        <span>
                                            Quick answers for your wellness journey
                                        </span>
                                    </div>

                                </div>

                            </div>


                            <button
                                onClick={handleClose}
                                className="customer-chatbot-close"
                                type="button"
                                aria-label="Close Aumveda Help"
                            >

                                <X size={18} />

                            </button>

                        </div>


                        {/* ======================================
                            SEARCH
                        ====================================== */}

                        <form
                            onSubmit={handleSearch}
                            className="customer-chatbot-search"
                        >

                            <Search
                                size={16}
                                className="customer-chatbot-search-icon"
                            />

                            <input
                                value={searchQuery}
                                onChange={(event) =>
                                    setSearchQuery(
                                        event.target.value
                                    )
                                }
                                placeholder="Search your question..."
                                className="customer-chatbot-search-input"
                                aria-label="Search frequently asked questions"
                            />

                        </form>

                    </div>


                    {/* ==========================================
                        CONTENT
                    ========================================== */}

                    <div
                        className="customer-chatbot-content"
                    >

                        {/* ERROR */}

                        {error && (

                            <div
                                className="customer-chatbot-error"
                                role="alert"
                            >
                                {error}
                            </div>

                        )}


                        {/* LOADING */}

                        {loading || searching ? (

                            <div
                                className="customer-chatbot-loading"
                                role="status"
                            >
                                <span className="customer-chatbot-spinner" />
                                <span>
                                    {searching ? "Searching FAQs..." : "Finding the right answer..."}
                                </span>
                            </div>

                        ) : selectedFAQ ? (

                            /* ==================================
                               ANSWER
                            ================================== */

                            <div>

                                <button
                                    onClick={handleBack}
                                    className="customer-chatbot-back"
                                    type="button"
                                >

                                    <ArrowLeft
                                        size={15}
                                    />

                                    Back

                                </button>


                                <div
                                    className="customer-chatbot-answer-icon"
                                >

                                    <HelpCircle
                                        size={21}
                                    />

                                </div>


                                <h3
                                    className="customer-chatbot-question-title"
                                >
                                    {selectedFAQ.question}
                                </h3>


                                <div
                                    className="customer-chatbot-answer"
                                >
                                    {selectedFAQ.answer}
                                </div>

                            </div>

                        ) : selectedCategory ? (

                            /* ==================================
                               CATEGORY QUESTIONS
                            ================================== */

                            <div>

                                <button
                                    onClick={handleBack}
                                    className="customer-chatbot-back"
                                    type="button"
                                >

                                    <ArrowLeft
                                        size={15}
                                    />

                                    All topics

                                </button>


                                <div
                                    style={{
                                        marginBottom: "14px",
                                    }}
                                >

                                    <h3
                                        style={{
                                            margin: 0,
                                            fontSize: "16px",
                                            color: "#26382C",
                                        }}
                                    >
                                        {selectedCategory.name}
                                    </h3>

                                    {selectedCategory.description && (

                                        <p
                                            style={{
                                                margin:
                                                    "5px 0 0",
                                                color: "#7A847E",
                                                fontSize: "11px",
                                                lineHeight: 1.5,
                                            }}
                                        >
                                            {
                                                selectedCategory.description
                                            }
                                        </p>

                                    )}

                                </div>


                                {currentFAQs.length === 0 ? (

                                    <div
                                        style={{
                                            padding: "28px 10px",
                                            textAlign: "center",
                                            color: "#7A847E",
                                            fontSize: "12px",
                                        }}
                                    >
                                        No questions available.
                                    </div>

                                ) : (

                                    currentFAQs.map(
                                        (faq) => (

                                            <button
                                                key={faq.id}
                                                className="customer-chatbot-option"
                                                onClick={() =>
                                                    handleFAQClick(
                                                        faq
                                                    )
                                                }
                                            >

                                                <span
                                                    className="customer-chatbot-option-icon"
                                                    aria-hidden="true"
                                                >
                                                    <HelpCircle size={16} />
                                                </span>

                                                <span className="customer-chatbot-option-label">
                                                    {faq.question}
                                                </span>

                                                <ChevronRight
                                                    size={16}
                                                    color="#829087"
                                                />

                                            </button>

                                        )
                                    )

                                )}

                            </div>

                        ) : searchResults.length > 0 ? (

                            /* ==================================
                               SEARCH RESULTS
                            ================================== */

                            <div>

                                <div className="customer-chatbot-results-heading">

                                    <h3
                                        className="customer-chatbot-section-title"
                                    >
                                        Search results
                                    </h3>

                                    <button
                                        onClick={() =>
                                            setSearchResults(
                                                []
                                            )
                                        }
                                        className="customer-chatbot-clear"
                                        type="button"
                                    >
                                        Clear
                                    </button>

                                </div>


                                {searchResults.map(
                                    (faq) => (

                                        <button
                                            key={faq.id}
                                            className="customer-chatbot-option"
                                            onClick={() =>
                                                handleFAQClick(
                                                    faq
                                                )
                                            }
                                        >

                                            <span
                                                className="customer-chatbot-option-icon"
                                                aria-hidden="true"
                                            >
                                                <HelpCircle size={16} />
                                            </span>

                                            <span className="customer-chatbot-option-label">
                                                {faq.question}
                                            </span>

                                            <ChevronRight
                                                size={16}
                                                color="#829087"
                                            />

                                        </button>

                                    )
                                )}

                            </div>

                        ) : (

                            /* ==================================
                               CATEGORIES
                            ================================== */

                            <div>

                                <div className="customer-chatbot-category-heading">

                                    <h3
                                        className="customer-chatbot-section-title"
                                    >
                                        How can we help?
                                    </h3>

                                    <p
                                        className="customer-chatbot-section-description"
                                    >
                                        Select a topic to find
                                        answers.
                                    </p>

                                </div>


                                {categories.map(
                                    (category) => (

                                        <button
                                            key={category.id}
                                            className="customer-chatbot-option customer-chatbot-category-option"
                                            onClick={() =>
                                                handleCategoryClick(
                                                    category
                                                )
                                            }
                                        >

                                            <span className="customer-chatbot-option-icon">
                                                <HelpCircle size={17} />
                                            </span>

                                            <div className="customer-chatbot-option-copy">

                                                <div className="customer-chatbot-option-label">
                                                    {
                                                        category.name
                                                    }
                                                </div>

                                                {category.description && (

                                                    <div
                                                        className="customer-chatbot-option-description"
                                                    >
                                                        {
                                                            category.description
                                                        }
                                                    </div>

                                                )}

                                            </div>


                                            <ChevronRight
                                                size={17}
                                                color="#829087"
                                            />

                                        </button>

                                    )
                                )}

                            </div>

                        )}

                    </div>

                </div>

            )}


            {/* ==================================================
                FLOATING BUTTON
            ================================================== */}

            <button
                className="customer-chatbot-launcher"
                onClick={isOpen ? handleClose : openChatbot}
                aria-label={isOpen ? "Close Aumveda Help" : "Open Aumveda Help"}
                aria-expanded={isOpen}
                type="button"
            >

                {isOpen ? (
                    <X size={23} />
                ) : (
                    <MessageCircle size={23} />
                )}

            </button>

        </>
    );
}