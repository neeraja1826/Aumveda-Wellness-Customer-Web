import api from "./api";

// ============================================================
// FAQ CHATBOT
// ============================================================

// Get active FAQ categories
export const getChatbotCategories = () =>
    api.get("/chatbot/categories");


// Get active FAQs
export const getChatbotFAQs = (categoryId = null) =>
    api.get("/chatbot/faqs", {
        params: categoryId
            ? { category_id: categoryId }
            : {},
    });


// Get a single FAQ
export const getChatbotFAQ = (faqId) =>
    api.get(`/chatbot/faqs/${encodeURIComponent(faqId)}`);


// Search FAQs
export const searchChatbotFAQs = (query) =>
    api.get("/chatbot/search", {
        params: {
            q: query,
        },
    });