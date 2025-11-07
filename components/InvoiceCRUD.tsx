import React, { useState, useEffect, useMemo } from 'react';
import { getMemos, deleteMemo, getInvoices } from '../services/googleScriptMock';
import { MemoData } from '../types';
import { useToast } from '../hooks/useToast';
import Card from './ui/Card';
import Button from './ui/Button';
import Spinner from './ui/Spinner';
import Input from './ui/Input';

interface MemoCRUDProps {
    onEditMemo: (memoNo: string) => void;
    onDownloadMemo: (memoNo: string) => void;
}

const MemoCRUD: React.FC<MemoCRUDProps> = ({ onEditMemo, onDownloadMemo }) => {
    const [memos, setMemos] = useState<MemoData[]>([]);
    const [invoiceMap, setInvoiceMap] = useState<Map<string, string>>(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { addToast } = useToast();

    // Delete confirmation modal state
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [memoToDelete, setMemoToDelete] = useState<MemoData | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [memoData, invoiceData] = await Promise.all([getMemos(), getInvoices()]);
            
            const newInvoiceMap = new Map<string, string>();
            invoiceData.forEach(invoice => {
                invoice.memo_nos.forEach(memoNo => {
                    newInvoiceMap.set(memoNo, invoice.invoice_no);
                });
            });
            setInvoiceMap(newInvoiceMap);
            
            setMemos(memoData.sort((a, b) => b.trips_memo_no.localeCompare(a.trips_memo_no)));
        } catch (error) {
            addToast('Failed to fetch memo and invoice data.', 'error');
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
            return memos;
        }
        return memos.filter(memo =>
            memo.trips_memo_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
            memo.customers_name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [memos, searchTerm]);

    const openDeleteConfirmation = (memo: MemoData) => {
        setMemoToDelete(memo);
        setIsDeleteConfirmOpen(true);
    };

    const closeDeleteConfirmation = () => {
        setMemoToDelete(null);
        setIsDeleteConfirmOpen(false);
    };

    const handleDelete = async () => {
        if (memoToDelete) {
            setIsSubmitting(true);
            try {
                await deleteMemo(memoToDelete.trips_memo_no);
                addToast('Memo deleted successfully', 'success');
                await fetchData();
            } catch (error) {
                addToast('Failed to delete memo', 'error');
            } finally {
                setIsSubmitting(false);
                closeDeleteConfirmation();
            }
        }
    };

    const headers = ["Memo No", "Date", "Customer Name", "Vehicle No", "Balance", "Status", "Actions"];

    return (
        <Card title="Manage Memos">
            <div className="flex justify-between items-center mb-4">
                <Input
                    id="search"
                    label=""
                    placeholder="Search by Memo No or Customer..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-1/3"
                />
            </div>
            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Spinner />
                </div>
            ) : (
                <div className="overflow-x-auto max-h-[70vh]">
                    <table className="min-w-full bg-white text-sm">
                        <thead className="bg-gray-200 sticky top-0">
                            <tr>
                                {headers.map((header) => (
                                    <th key={header} className="px-4 py-2 text-left font-semibold text-gray-700">{header}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.map((memo) => {
                                const invoiceNo = invoiceMap.get(memo.trips_memo_no);
                                const isInvoiced = !!invoiceNo;

                                return (
                                <tr key={memo.trips_memo_no} className="border-b hover:bg-gray-50">
                                    <td className="px-4 py-2 font-medium">{memo.trips_memo_no}</td>
                                    <td className="px-4 py-2">{memo.trip_operated_date1}</td>
                                    <td className="px-4 py-2">{memo.customers_name}</td>
                                    <td className="px-4 py-2">{memo.trips_vehicle_no}</td>
                                    <td className="px-4 py-2 text-right">{parseFloat(memo.trips_balance).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</td>
                                    <td className="px-4 py-2">
                                        {isInvoiced ? (
                                            <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded-full">
                                                {invoiceNo}
                                            </span>
                                        ) : (
                                            <span className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 rounded-full">
                                                Uninvoiced
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="flex space-x-4">
                                            <button 
                                                onClick={() => onEditMemo(memo.trips_memo_no)} 
                                                className="text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed"
                                                disabled={isInvoiced}
                                                title={isInvoiced ? "Cannot edit a memo that is part of an invoice." : "Edit Memo"}
                                            >
                                                Edit
                                            </button>
                                            <button onClick={() => onDownloadMemo(memo.trips_memo_no)} className="flex items-center text-green-600 hover:underline">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                Download PDF
                                            </button>
                                            <button 
                                                onClick={() => openDeleteConfirmation(memo)} 
                                                className="text-red-600 hover:underline disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed"
                                                disabled={isInvoiced}
                                                title={isInvoiced ? "Cannot delete a memo that is part of an invoice." : "Delete Memo"}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
            )}
            
             {isDeleteConfirmOpen && memoToDelete && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                        <h3 className="text-lg font-bold mb-4">Confirm Deletion</h3>
                        <p>Are you sure you want to delete memo <strong>{memoToDelete.trips_memo_no}</strong> for <strong>{memoToDelete.customers_name}</strong>? This action cannot be undone.</p>
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

export default MemoCRUD;