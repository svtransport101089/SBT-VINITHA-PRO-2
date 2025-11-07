import React, { useState, useEffect, useMemo } from 'react';
import { getInvoices, deleteInvoice } from '../services/googleScriptMock';
import { Invoice, InvoiceStatus } from '../types';
import { useToast } from '../hooks/useToast';
import Card from './ui/Card';
import Button from './ui/Button';
import Spinner from './ui/Spinner';
import Input from './ui/Input';

interface InvoiceCRUDProps {
    onEditInvoice: (invoiceId: number) => void;
    onCreateInvoice: () => void;
    onDownloadInvoice: (invoiceId: number) => void;
}

const getStatusStyles = (status: InvoiceStatus) => {
    switch (status) {
        case 'Paid': return 'bg-green-100 text-green-800 border-green-300';
        case 'Finalized': return 'bg-blue-100 text-blue-800 border-blue-300';
        case 'Draft': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
        default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
};

const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const DownloadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>;


const InvoiceCRUD: React.FC<InvoiceCRUDProps> = ({ onEditInvoice, onCreateInvoice, onDownloadInvoice }) => {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { addToast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Modal state
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const data = await getInvoices();
            setInvoices(data.sort((a, b) => b.invoice_no.localeCompare(a.invoice_no)));
        } catch (error) {
            addToast('Failed to fetch invoices.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filteredData = useMemo(() => {
        if (!searchTerm) {
            return invoices;
        }
        return invoices.filter(invoice =>
            invoice.invoice_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
            invoice.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [invoices, searchTerm]);

    const openDeleteConfirmation = (invoice: Invoice) => {
        setInvoiceToDelete(invoice);
        setIsDeleteConfirmOpen(true);
    };

    const closeDeleteConfirmation = () => {
        setInvoiceToDelete(null);
        setIsDeleteConfirmOpen(false);
    };

    const handleDelete = async () => {
        if (invoiceToDelete?.id) {
            setIsSubmitting(true);
            try {
                await deleteInvoice(invoiceToDelete.id);
                addToast('Invoice deleted successfully', 'success');
                await fetchData();
            } catch (error) {
                addToast('Failed to delete invoice', 'error');
            } finally {
                setIsSubmitting(false);
                closeDeleteConfirmation();
            }
        }
    };

    return (
        <Card title="Manage Invoices">
            <div className="flex justify-between items-center mb-6">
                <div className="w-full md:w-1/3">
                    <Input
                        id="searchInvoices"
                        label=""
                        placeholder="Search by Invoice No or Customer..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button onClick={onCreateInvoice}>Create New Invoice</Button>
            </div>
            {isLoading ? (
                <div className="flex justify-center items-center h-64"><Spinner /></div>
            ) : (
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                    {filteredData.length > 0 ? (
                        filteredData.map((invoice) => (
                           <div key={invoice.id} className="bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-300 p-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="text-lg font-bold text-blue-700">{invoice.invoice_no}</h4>
                                        <p className="text-sm text-gray-600">{invoice.customer_name}</p>
                                    </div>
                                    <span className={`px-3 py-1 text-xs font-bold rounded-full border ${getStatusStyles(invoice.status)}`}>
                                        {invoice.status}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm border-t pt-4">
                                    <div>
                                        <p className="font-medium text-gray-500">Invoice Date</p>
                                        <p className="text-gray-800">{invoice.invoice_date}</p>
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-500">Total Amount</p>
                                        <p className="text-gray-800 font-semibold">{invoice.total_amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</p>
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-500">Balance</p>
                                        <p className="font-bold text-red-600">{invoice.balance.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</p>
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-500">Memos</p>
                                        <p className="text-gray-800">{invoice.memo_nos.length}</p>
                                    </div>
                                </div>
                                <div className="flex justify-end items-center mt-4 space-x-2">
                                     <button onClick={() => onDownloadInvoice(invoice.id!)} className="flex items-center text-sm px-3 py-1 rounded-md text-green-600 bg-green-100 hover:bg-green-200 transition-colors">
                                        <DownloadIcon /> Download
                                    </button>
                                     <button onClick={() => onEditInvoice(invoice.id!)} className="flex items-center text-sm px-3 py-1 rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200 transition-colors">
                                        <EditIcon /> Edit
                                    </button>
                                    <button onClick={() => openDeleteConfirmation(invoice)} className="flex items-center text-sm px-3 py-1 rounded-md text-red-600 bg-red-100 hover:bg-red-200 transition-colors">
                                        <DeleteIcon /> Delete
                                    </button>
                                </div>
                           </div>
                        ))
                    ) : (
                         <div className="text-center py-16">
                            <h3 className="text-xl font-semibold text-gray-700">No Invoices Found</h3>
                            <p className="text-gray-500 mt-2">Create a new invoice to get started.</p>
                        </div>
                    )}
                </div>
            )}
            {isDeleteConfirmOpen && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                        <h3 className="text-lg font-bold mb-4">Confirm Deletion</h3>
                        <p>Are you sure you want to delete invoice <strong>{invoiceToDelete?.invoice_no}</strong>? This action cannot be undone.</p>
                        <div className="flex justify-end mt-6 space-x-3">
                            <Button onClick={closeDeleteConfirmation} className="bg-gray-300 text-gray-800 hover:bg-gray-400">Cancel</Button>
                            <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-700" disabled={isSubmitting}>
                                {isSubmitting ? <Spinner/> : 'Delete'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
};

export default InvoiceCRUD;