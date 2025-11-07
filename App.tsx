import React, { useState, useMemo } from 'react';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import PageWrapper from './components/layout/PageWrapper';
import CustomerCRUD from './components/CustomerCRUD';
import ViewServices from './components/ViewServices';
import MemoForm from './components/forms/InvoiceForm';
import { ToastProvider } from './hooks/useToast';
import { Page } from './types';
import Dashboard from './components/Dashboard';
import AreasCRUD from './components/AreasCRUD';
import CalculationsCRUD from './components/CalculationsCRUD';
import MemoCRUD from './components/InvoiceCRUD';
import LookupCRUD from './components/LookupCRUD';
import InvoiceCRUD from './components/LocationsCRUD'; // Repurposed for new Invoice CRUD
import InvoiceForm from './components/forms/NewTripForm'; // Repurposed for new Invoice Form

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>(Page.DASHBOARD);
  const [editingMemoNo, setEditingMemoNo] = useState<string | null>(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState<number | null>(null);
  const [printOnLoad, setPrintOnLoad] = useState(false);
  const [printInvoiceOnLoad, setPrintInvoiceOnLoad] = useState(false);

  const handleNavigate = (page: Page) => {
    setEditingMemoNo(null);
    setEditingInvoiceId(null);
    setPrintOnLoad(false);
    setPrintInvoiceOnLoad(false);
    setCurrentPage(page);
  };

  // Memo Handlers
  const handleEditMemo = (memoNo: string) => {
    setEditingMemoNo(memoNo);
    setPrintOnLoad(false);
    setCurrentPage(Page.CREATE_MEMO);
  };

  const handleDownloadMemo = (memoNo: string) => {
    setEditingMemoNo(memoNo);
    setPrintOnLoad(true);
    setCurrentPage(Page.CREATE_MEMO);
  };

  const handleMemoFormClose = () => {
    setEditingMemoNo(null);
    setPrintOnLoad(false);
    setCurrentPage(Page.MANAGE_MEMOS);
  };
  
  // New Invoice Handlers
  const handleEditInvoice = (invoiceId: number) => {
      setEditingInvoiceId(invoiceId);
      setPrintInvoiceOnLoad(false);
      setCurrentPage(Page.INVOICE_FORM);
  };

  const handleDownloadInvoice = (invoiceId: number) => {
      setEditingInvoiceId(invoiceId);
      setPrintInvoiceOnLoad(true);
      setCurrentPage(Page.INVOICE_FORM);
  };

  const handleInvoiceFormClose = () => {
      setEditingInvoiceId(null);
      setPrintInvoiceOnLoad(false);
      setCurrentPage(Page.MANAGE_INVOICES);
  };

  const renderPage = useMemo(() => {
    switch (currentPage) {
      case Page.DASHBOARD:
        return <Dashboard />;
      case Page.CREATE_MEMO:
        return <MemoForm 
                  memoToLoad={editingMemoNo} 
                  onSaveSuccess={handleMemoFormClose}
                  onCancel={handleMemoFormClose} 
                  printOnLoad={printOnLoad}
                  onPrinted={handleMemoFormClose}
               />;
      case Page.MANAGE_MEMOS:
        return <MemoCRUD onEditMemo={handleEditMemo} onDownloadMemo={handleDownloadMemo} />;
      case Page.MANAGE_INVOICES:
        return <InvoiceCRUD onEditInvoice={handleEditInvoice} onCreateInvoice={() => setCurrentPage(Page.INVOICE_FORM)} onDownloadInvoice={handleDownloadInvoice} />;
      case Page.INVOICE_FORM:
        return <InvoiceForm invoiceIdToLoad={editingInvoiceId} onSaveSuccess={handleInvoiceFormClose} onCancel={handleInvoiceFormClose} printOnLoad={printInvoiceOnLoad} onPrinted={handleInvoiceFormClose} />;
      case Page.MANAGE_CUSTOMERS:
        return <CustomerCRUD />;
      case Page.VIEW_ALL_SERVICES:
        return <ViewServices />;
      case Page.MANAGE_AREAS:
        return <AreasCRUD />;
      case Page.MANAGE_CALCULATIONS:
        return <CalculationsCRUD />;
      case Page.MANAGE_LOOKUP:
        return <LookupCRUD />;
      default:
        return <Dashboard />;
    }
  }, [currentPage, editingMemoNo, editingInvoiceId, printOnLoad, printInvoiceOnLoad]);

  const pageTitle = useMemo(() => {
    if (currentPage === Page.CREATE_MEMO && editingMemoNo) {
      return printOnLoad ? `Download Memo: ${editingMemoNo}` : `Edit Memo: ${editingMemoNo}`;
    }
    if (currentPage === Page.INVOICE_FORM) {
        if (printInvoiceOnLoad) {
            return `Download Invoice`;
        }
        return editingInvoiceId ? `Edit Invoice` : 'Create New Invoice';
    }
    const pageName = currentPage.replace(/_/g, ' ');
    return pageName.charAt(0).toUpperCase() + pageName.slice(1).toLowerCase();
  }, [currentPage, editingMemoNo, editingInvoiceId, printOnLoad, printInvoiceOnLoad]);


  return (
    <ToastProvider>
      <div className="flex h-screen bg-gray-100 font-sans">
        <Sidebar currentPage={currentPage} setCurrentPage={handleNavigate} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title={pageTitle} />
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100">
            <PageWrapper>
              {renderPage}
            </PageWrapper>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
};

export default App;