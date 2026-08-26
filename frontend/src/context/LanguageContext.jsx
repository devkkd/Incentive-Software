'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

// ─── All translations ───────────────────────────────────────────────
const translations = {
  en: {
    // Auth
    signInAdmin: 'Sign in to Admin Portal',
    accessAdminPortal: 'Enter your credentials to access the admin dashboard',
    welcomeBack: 'Welcome Back',
    signInSubtitle: 'Sign in to your branch account to continue',
    email: 'Email Address',
    password: 'Password',
    forgotPasswordQ: 'Forgot Password?',
    keepSignedIn: 'Keep me signed in',
    signIn: 'Sign In',
    enterEmailLinked: 'Enter the email linked to your branch account',
    dontHaveAccount: "Don't have an account?",
    contactRepresentative: 'Contact your FTC representative to get access.',

    // Common
    search: 'Search',
    logout: 'Log out',
    loading: 'Loading...',
    cancel: 'Cancel',
    save: 'Save Changes',
    create: 'Create',
    edit: 'Edit',
    block: 'Block',
    activate: 'Activate',
    deactivate: 'Deactivate',
    status: 'Status',
    active: 'Active',
    inactive: 'Inactive',
    blocked: 'Blocked',
    action: 'Action',
    created: 'Created',
    total: 'total',
    back: 'Back',
    download: 'Download',
    noData: 'No data found',
    noDataSub: 'Try adjusting your search or filter',

    // Header / Portal
    adminPortal: 'Admin Portal',
    branchPortal: 'Branch Portal',
    welcomeMsg: 'Welcome to Faith Trust Commitment - Incentive Management',

    // Sidebar
    dashboard: 'Dashboardddddssss',
    allInvoicesSidebar: 'All Invoices',
    allVendorsSidebar: 'Party List',
    allBranchesSidebar: 'Create Account',
    allDivisionsSidebar: 'All Location',
    incentivesSidebar: 'Incentives',
    walletManagementSidebar: 'Wallet Management',
    reportsSidebar: 'All Reports',
    settingsSidebar: 'Account Settings',

    // Dashboard
    totalVendors: 'Total Vendors',
    totalInvoices: 'Total Invoices',
    totalIncentives: 'Total Incentives Uploaded',
    walletBalance: 'Total Wallet Balance',
    recentActivity: 'Recent Activity',

    // Vendors
    allVendors: 'All Party',
    createVendor: 'Create Vendor',
    importExcel: 'Import Excel',
    template: 'Template',
    companyName: 'Company Name',
    personName: 'Contact Person',
    accountNo: 'Account No.',
    mobile: 'Mobile',
    salesPerson: 'Sales Person',
    walletAvailable: 'Wallet Balance',
    lastRedemption: 'Last Redemption',
    vendorCompanyName: 'Vendor Company Name',
    vendorMobile: 'Vendor Mobile Number',
    vendorAccount: 'Party Code',
    address: 'Full Address',
    emailOptional: 'Email Address (Optional)',
    divisionLabel: 'Division',
    createVendorTitle: 'Create New Vendor',
    companyInfo: 'Company Information',
    contactDetails: 'Contact Details',
    noVendors: 'No vendors found',
    showingOf: 'Showing',
    of: 'of',
    vendors: 'vendors',

    // Invoices
    allInvoices: 'All Invoices',
    invoiceNo: 'Invoice No.',
    invoiceDate: 'Invoice Date',
    invoiceAmount: 'Invoice Amount',
    location: 'Location',
    createInvoice: 'Create Invoice',
    noInvoices: 'No invoices found',

    // Divisions
    allDivisions: 'All Divisions',
    createDivision: 'Create New Division',
    divisionName: 'Branch Code',
    locationCity: 'Location / City',
    serialNo: 'Invoice No.',
    invoicePrefix: 'Invoice Prefix',
    vendorPrefix: 'Vendor Prefix',
    code: 'Code',
    noDivisions: 'No divisions yet',
    noDivisionsSub: 'Use the form above to create your first division',

    // Branches
    allBranches: 'All Party',
    createBranch: 'Create New Account',
    branchName: 'Branch Name',
    locationCode: 'Location Code',
    noBranches: 'No branches yet',
    noBranchesSub: 'Use the form above to create your first branch',

    // Incentives
    incentives: 'Incentives',
    uploadIncentive: 'Upload Incentive File',
    frequency: 'Frequency',
    sendOtp: 'Send OTP',
    verifyUpload: 'Verify & Upload',
    uploadHistory: 'Upload History',
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',

    // Reports
    allReports: 'All Reports',
    reports: 'Reports',
    exportPdf: 'Export PDF',
    exportExcel: 'Export Excel',

    // Settings
    settings: 'Account Settings',
    changePassword: 'Change Password',
    currentPassword: 'Current Password',
    newPassword: 'New Password',
    confirmPassword: 'Confirm Password',
    updatePassword: 'Update Password',
    profileInfo: 'Profile Information',

    // Redemption
    redeemWallet: 'Redeem Wallet',
    redeemAmount: 'Redeem Amount',
    availableBalance: 'Available Balance',
    confirmRedeem: 'Confirm Redemption',
  },

  hi: {
    // Auth
    signInAdmin: 'एडमिन पोर्टल में साइन इन करें',
    accessAdminPortal: 'एडमिन डैशबोर्ड एक्सेस करने के लिए अपनी जानकारी दर्ज करें',
    welcomeBack: 'वापस स्वागत है',
    signInSubtitle: 'जारी रखने के लिए अपने ब्रांच अकाउंट में साइन इन करें',
    email: 'ईमेल पता',
    password: 'पासवर्ड',
    forgotPasswordQ: 'पासवर्ड भूल गए?',
    keepSignedIn: 'मुझे साइन इन रखें',
    signIn: 'साइन इन करें',
    enterEmailLinked: 'अपने ब्रांच अकाउंट से जुड़ा ईमेल दर्ज करें',
    dontHaveAccount: 'अकाउंट नहीं है?',
    contactRepresentative: 'एक्सेस पाने के लिए अपने FTC प्रतिनिधि से संपर्क करें।',

    // Common
    search: 'खोजें',
    logout: 'लॉग आउट',
    loading: 'लोड हो रहा है...',
    cancel: 'रद्द करें',
    save: 'बदलाव सहेजें',
    create: 'बनाएं',
    edit: 'संपादित करें',
    block: 'ब्लॉक करें',
    activate: 'सक्रिय करें',
    deactivate: 'निष्क्रिय करें',
    status: 'स्थिति',
    active: 'सक्रिय',
    inactive: 'निष्क्रिय',
    blocked: 'ब्लॉक',
    action: 'कार्रवाई',
    created: 'बनाया गया',
    total: 'कुल',
    back: 'वापस',
    download: 'डाउनलोड',
    noData: 'कोई डेटा नहीं मिला',
    noDataSub: 'अपनी खोज या फ़िल्टर बदलकर देखें',

    // Header / Portal
    adminPortal: 'एडमिन पोर्टल',
    branchPortal: 'ब्रांच पोर्टल',
    welcomeMsg: 'फेथ ट्रस्ट कमिटमेंट - इंसेंटिव मैनेजमेंट में आपका स्वागत है',

    // Sidebar
    dashboard: 'डैशबोर्ड',
    allInvoicesSidebar: 'सभी चालान',
    allVendorsSidebar: 'सभी विक्रेता/पार्टी',
    allBranchesSidebar: 'सभी शाखाएं',
    allDivisionsSidebar: 'सभी डिवीजन',
    incentivesSidebar: 'प्रोत्साहन',
    reportsSidebar: 'सभी रिपोर्ट',
    settingsSidebar: 'खाता सेटिंग',

    // Dashboard
    totalVendors: 'कुल विक्रेता',
    totalInvoices: 'कुल चालान',
    totalIncentives: 'कुल अपलोड किए गए प्रोत्साहन',
    walletBalance: 'कुल वॉलेट बैलेंस',
    recentActivity: 'हाल की गतिविधि',

    // Vendors
    allVendors: 'सभी विक्रेता/पार्टी',
    createVendor: 'विक्रेता बनाएं',
    importExcel: 'एक्सेल आयात करें',
    template: 'टेम्पलेट',
    companyName: 'कंपनी का नाम',
    personName: 'संपर्क व्यक्ति',
    accountNo: 'खाता नंबर',
    mobile: 'मोबाइल',
    salesPerson: 'सेल्स पर्सन',
    walletAvailable: 'वॉलेट बैलेंस',
    lastRedemption: 'अंतिम रिडेम्पशन',
    vendorCompanyName: 'विक्रेता कंपनी का नाम',
    vendorMobile: 'विक्रेता मोबाइल नंबर',
    vendorAccount: 'विक्रेता खाता नंबर',
    address: 'पूरा पता',
    emailOptional: 'ईमेल पता (वैकल्पिक)',
    divisionLabel: 'डिवीजन',
    createVendorTitle: 'नया विक्रेता बनाएं',
    companyInfo: 'कंपनी की जानकारी',
    contactDetails: 'संपर्क विवरण',
    noVendors: 'कोई विक्रेता नहीं मिला',
    showingOf: 'दिखाया जा रहा है',
    of: 'में से',
    vendors: 'विक्रेता',

    // Invoices
    allInvoices: 'सभी चालान',
    invoiceNo: 'चालान नंबर',
    invoiceDate: 'चालान तारीख',
    invoiceAmount: 'चालान राशि',
    location: 'स्थान',
    createInvoice: 'चालान बनाएं',
    noInvoices: 'कोई चालान नहीं मिला',

    // Divisions
    allDivisions: 'सभी डिवीजन',
    createDivision: 'नया डिवीजन बनाएं',
    divisionName: 'ब्रांच कोड',
    locationCity: 'स्थान / शहर',
    serialNo: 'क्रम संख्या',
    invoicePrefix: 'चालान उपसर्ग',
    vendorPrefix: 'विक्रेता उपसर्ग',
    code: 'कोड',
    noDivisions: 'अभी कोई डिवीजन नहीं',
    noDivisionsSub: 'पहला डिवीजन बनाने के लिए ऊपर दिए फॉर्म का उपयोग करें',

    // Branches
    allBranches: 'सभी शाखाएं',
    createBranch: 'नई शाखा बनाएं',
    branchName: 'शाखा का नाम',
    locationCode: 'स्थान कोड',
    noBranches: 'अभी कोई शाखा नहीं',
    noBranchesSub: 'पहली शाखा बनाने के लिए ऊपर दिए फॉर्म का उपयोग करें',

    // Incentives
    incentives: 'प्रोत्साहन',
    uploadIncentive: 'प्रोत्साहन फ़ाइल अपलोड करें',
    frequency: 'आवृत्ति',
    sendOtp: 'OTP भेजें',
    verifyUpload: 'सत्यापित करें और अपलोड करें',
    uploadHistory: 'अपलोड इतिहास',
    daily: 'दैनिक',
    weekly: 'साप्ताहिक',
    monthly: 'मासिक',

    // Reports
    allReports: 'सभी रिपोर्ट',
    reports: 'रिपोर्ट',
    exportPdf: 'PDF निर्यात करें',
    exportExcel: 'Excel निर्यात करें',

    // Settings
    settings: 'खाता सेटिंग',
    changePassword: 'पासवर्ड बदलें',
    currentPassword: 'वर्तमान पासवर्ड',
    newPassword: 'नया पासवर्ड',
    confirmPassword: 'पासवर्ड की पुष्टि करें',
    updatePassword: 'पासवर्ड अपडेट करें',
    profileInfo: 'प्रोफ़ाइल जानकारी',

    // Redemption
    redeemWallet: 'वॉलेट रिडीम करें',
    redeemAmount: 'रिडीम राशि',
    availableBalance: 'उपलब्ध बैलेंस',
    confirmRedeem: 'रिडेम्पशन की पुष्टि करें',
  },
};

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState('en');

  useEffect(() => {
    const saved = localStorage.getItem('lang');
    if (saved === 'hi' || saved === 'en') setLang(saved);
  }, []);

  const switchLang = (l) => {
    setLang(l);
    localStorage.setItem('lang', l);
  };

  const t = (key) => translations[lang]?.[key] ?? translations['en']?.[key] ?? key;

  return (
    <LanguageContext.Provider value={{ lang, switchLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLang = () => useContext(LanguageContext);
