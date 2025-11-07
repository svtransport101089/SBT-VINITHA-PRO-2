import React, { useState, useEffect, useCallback } from 'react';
import { Invoice, MemoData, Customer, InvoiceStatus } from '../../types';
import { getCustomers, getUninvoicedMemosForCustomer, addInvoice, updateInvoice, generateNewInvoiceNumber, getInvoiceById, getMemos } from '../../services/googleScriptMock';
import { useToast } from '../../hooks/useToast';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import Input from '../ui/Input';
import ComboBox from '../ui/ComboBox';
import Select from '../ui/Select';

const initialInvoiceState: Omit<Invoice, 'id'> = {
    invoice_no: '',
    invoice_date: new Date().toISOString().split('T')[0],
    customer_name: '',
    memo_nos: [],
    total_amount: 0,
    amount_paid: 0,
    balance: 0,
    status: 'Draft',
};

interface InvoiceFormProps {
    invoiceIdToLoad: number | null;
    onSaveSuccess: () => void;
    onCancel: () => void;
    printOnLoad?: boolean;
    onPrinted?: () => void;
}

const InvoiceForm: React.FC<InvoiceFormProps> = ({ invoiceIdToLoad, onSaveSuccess, onCancel, printOnLoad = false, onPrinted = () => {} }) => {
    const [invoice, setInvoice] = useState<Partial<Invoice>>(initialInvoiceState);
    const [availableMemos, setAvailableMemos] = useState<MemoData[]>([]);
    const [allMemos, setAllMemos] = useState<Map<string, MemoData>>(new Map());
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { addToast } = useToast();

    const calculateTotals = useCallback(() => {
        const total = invoice.memo_nos?.reduce((sum, memoNo) => {
            const memo = allMemos.get(memoNo);
            return sum + (parseFloat(memo?.trips_total_amt || '0'));
        }, 0) || 0;
        
        const amountPaid = invoice.amount_paid || 0;
        const balance = total - amountPaid;

        setInvoice(prev => ({
            ...prev,
            total_amount: total,
            balance: balance,
        }));
    }, [invoice.memo_nos, invoice.amount_paid, allMemos]);

    useEffect(() => {
        calculateTotals();
    }, [calculateTotals]);

    useEffect(() => {
        const loadInitialData = async () => {
            setIsLoading(true);
            try {
                const [customersData, memosData] = await Promise.all([getCustomers(), getMemos()]);
                setCustomers(customersData);
                
                const memosMap = new Map<string, MemoData>();
                memosData.forEach(memo => memosMap.set(memo.trips_memo_no, memo));
                setAllMemos(memosMap);

                if (invoiceIdToLoad) {
                    const loadedInvoice = await getInvoiceById(invoiceIdToLoad);
                    if (loadedInvoice) {
                        setInvoice(loadedInvoice);
                        const uninvoicedMemos = await getUninvoicedMemosForCustomer(loadedInvoice.customer_name);
                        setAvailableMemos(uninvoicedMemos);
                    } else {
                        addToast(`Invoice not found.`, 'error');
                        onCancel();
                    }
                } else {
                    const newInvoiceNo = await generateNewInvoiceNumber();
                    setInvoice(prev => ({ ...initialInvoiceState, invoice_no: newInvoiceNo }));
                }
            } catch (error) {
                addToast('Failed to load initial data.', 'error');
            } finally {
                setIsLoading(false);
            }
        };
        loadInitialData();
    }, [invoiceIdToLoad, addToast, onCancel]);
    
    useEffect(() => {
        if (!isLoading && printOnLoad) {
            const handleAfterPrint = () => {
                window.removeEventListener('afterprint', handleAfterPrint);
                setTimeout(() => {
                    if (onPrinted) onPrinted();
                }, 100);
            };

            window.addEventListener('afterprint', handleAfterPrint);

            const printTimer = setTimeout(() => {
                window.print();
            }, 300);

            return () => {
                clearTimeout(printTimer);
                window.removeEventListener('afterprint', handleAfterPrint);
            };
        }
    }, [isLoading, printOnLoad, onPrinted]);

    const handleCustomerChange = async (customerName: string) => {
        if (invoice.id) return;
        setInvoice(prev => ({ ...prev, customer_name: customerName, memo_nos: [] }));
        if (customerName) {
            const memos = await getUninvoicedMemosForCustomer(customerName);
            setAvailableMemos(memos);
        } else {
            setAvailableMemos([]);
        }
    };
    
    const handleMemoSelection = (memoNo: string, isSelected: boolean) => {
        setInvoice(prev => {
            const currentMemos = prev.memo_nos || [];
            const newMemos = isSelected 
                ? [...currentMemos, memoNo]
                : currentMemos.filter(m => m !== memoNo);
            return { ...prev, memo_nos: newMemos };
        });
    };

    const handleSave = async () => {
        if (!invoice.customer_name || !invoice.invoice_date || (invoice.memo_nos || []).length === 0) {
            addToast('Please select a customer, date, and at least one memo.', 'error');
            return;
        }
        setIsSaving(true);
        try {
            if (invoice.id) {
                await updateInvoice(invoice as Invoice);
                addToast('Invoice updated successfully!', 'success');
            } else {
                await addInvoice(invoice as Omit<Invoice, 'id'>);
                addToast('Invoice created successfully!', 'success');
            }
            onSaveSuccess();
        } catch (error) {
             addToast('Failed to save invoice.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="flex justify-center items-center h-64"><Spinner /></div>;

    const displayMemos = [...availableMemos];
    if (invoice.id && invoice.memo_nos) {
        invoice.memo_nos.forEach(memoNo => {
            if (!displayMemos.some(m => m.trips_memo_no === memoNo)) {
                const memo = allMemos.get(memoNo);
                if (memo) displayMemos.push(memo);
            }
        });
    }
    
    const selectedMemosDetails = (invoice.memo_nos || [])
        .map(memoNo => allMemos.get(memoNo))
        .filter((memo): memo is MemoData => memo !== undefined);

    return (
        <>
            <div className="print-hide">
                <Card title={invoice.id ? `Edit Invoice ${invoice.invoice_no}` : 'Create New Invoice'}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Input id="invoice_no" label="Invoice No" value={invoice.invoice_no || ''} readOnly />
                        <Input id="invoice_date" label="Invoice Date" type="date" value={invoice.invoice_date || ''} onChange={(e) => setInvoice(p => ({...p, invoice_date: e.target.value}))}/>
                        <div>
                            <label className="mb-2 font-medium text-sm text-gray-700">Customer</label>
                            <ComboBox
                                value={invoice.customer_name || ''}
                                onChange={handleCustomerChange}
                                options={customers.map(c => ({ value: c.customers_name, label: c.customers_name }))}
                                placeholder="Select a customer..."
                            />
                        </div>
                    </div>

                    <div className="mt-6">
                        <h4 className="font-semibold text-gray-700 mb-2">Available Memos for {invoice.customer_name}</h4>
                        <div className="border rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                            <table className="min-w-full bg-white text-sm">
                                <thead className="bg-gray-100 sticky top-0">
                                    <tr>
                                        <th className="p-3 text-left w-12"></th>
                                        <th className="p-3 text-left font-semibold">Memo No</th>
                                        <th className="p-3 text-left font-semibold">Date</th>
                                        <th className="p-3 text-left font-semibold">Vehicle No</th>
                                        <th className="p-3 text-right font-semibold">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayMemos.length > 0 ? displayMemos.map(memo => (
                                        <tr key={memo.trips_memo_no} className="border-t">
                                            <td className="p-3">
                                                <input 
                                                    type="checkbox"
                                                    className="h-4 w-4 rounded"
                                                    checked={invoice.memo_nos?.includes(memo.trips_memo_no)}
                                                    onChange={(e) => handleMemoSelection(memo.trips_memo_no, e.target.checked)}
                                                />
                                            </td>
                                            <td className="p-3 font-medium">{memo.trips_memo_no}</td>
                                            <td className="p-3">{memo.trip_operated_date1}</td>
                                            <td className="p-3">{memo.trips_vehicle_no}</td>
                                            <td className="p-3 text-right">{parseFloat(memo.trips_total_amt).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={5} className="p-4 text-center text-gray-500">No available memos for this customer.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 items-end">
                        <div>
                            <Select
                                id="status"
                                label="Invoice Status"
                                value={invoice.status || 'Draft'}
                                onChange={e => setInvoice(p => ({...p, status: e.target.value as InvoiceStatus}))}
                                options={[
                                    { value: 'Draft', label: 'Draft'},
                                    { value: 'Finalized', label: 'Finalized'},
                                    { value: 'Paid', label: 'Paid'},
                                ]}
                            />
                        </div>
                        <div className="md:col-start-3 grid grid-cols-2 gap-4 text-right items-center bg-gray-50 p-4 rounded-lg">
                            <span className="font-semibold">Total Amount:</span>
                            <span className="font-bold text-lg">{invoice.total_amount?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span>
                            
                            <label htmlFor="amount_paid" className="font-semibold">Amount Paid:</label>
                            <Input id="amount_paid" label="" type="number" value={invoice.amount_paid || ''} onChange={e => setInvoice(p => ({...p, amount_paid: parseFloat(e.target.value) || 0}))} className="text-right" />

                            <span className="font-semibold">Balance:</span>
                            <span className="font-bold text-lg">{invoice.balance?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span>
                        </div>
                    </div>

                    <div className="flex justify-end space-x-4 mt-8">
                        <Button type="button" onClick={() => window.print()} className="bg-green-600 hover:bg-green-700" disabled={!invoice.id} title={!invoice.id ? "Save the invoice first to download" : "Download as PDF"}>Download PDF</Button>
                        <Button type="button" onClick={onCancel} className="bg-gray-500 hover:bg-gray-600">Cancel</Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? <Spinner /> : 'Save Invoice'}
                        </Button>
                    </div>
                </Card>
            </div>
            
            <div className="invoice-print-area print-show">
                <div className="p-4 bg-white">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center">
                            <img src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhFY6OA_-B3xK_AfiNz8lGz87LIZIg9LxoslTBZtsl22lvtsG-zdRDyveJXTWCdNC9T3tKsmpjVOnN1zpEJhE97MD0J3zEN2MQ5ozlwXZkfbGOQAiZfEaw_KbWMF74rCDZD5E2wsqrkuZpwXIsELOMuqizXvIFs65ViFGdGqFuE9QpURT4jve_hr8K714M/s794/sbt%20logo.jpg" alt="SBT Transport Logo" className="h-20 w-auto mr-4" />
                            <div>
                                <h1 className="text-2xl font-bold text-blue-800">SRI BALAJI TRANSPORT</h1>
                                <p className="text-xs font-bold">NO:3/96, Kumaran Kudil Annex 3rd Street, Thuraipakkam, Chennai-97</p>
                                <p className="text-xs font-bold">Phone: 87789-92624, 97907-24160 | Email: sbttransport.75@gmail.com</p>
                            </div>
                        </div>
                        <h2 className="text-3xl font-bold text-gray-700">INVOICE</h2>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-6 p-2 border-y-2 border-black">
                        <div>
                            <h3 className="font-bold text-gray-800 mb-1">Bill To:</h3>
                            <p className="font-semibold text-lg">{invoice.customer_name}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm"><span className="font-bold">Invoice No:</span> {invoice.invoice_no}</p>
                            <p className="text-sm"><span className="font-bold">Invoice Date:</span> {invoice.invoice_date}</p>
                        </div>
                    </div>
                    
                    <div className="mt-6">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr>
                                    <th className="p-2 text-left font-bold">Memo No</th>
                                    <th className="p-2 text-left font-bold">Date</th>
                                    <th className="p-2 text-left font-bold">Vehicle No</th>
                                    <th className="p-2 text-right font-bold">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedMemosDetails.map(memo => (
                                    <tr key={memo.trips_memo_no}>
                                        <td className="p-2">{memo.trips_memo_no}</td>
                                        <td className="p-2">{memo.trip_operated_date1}</td>
                                        <td className="p-2">{memo.trips_vehicle_no}</td>
                                        <td className="p-2 text-right">{parseFloat(memo.trips_total_amt).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                     <div className="flex justify-end mt-4">
                        <div className="w-1/3 text-sm">
                            <div className="flex justify-between py-1 border-b">
                                <span className="font-bold">Total Amount:</span>
                                <span className="font-bold">{invoice.total_amount?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b">
                                <span className="font-bold">Amount Paid:</span>
                                <span>{invoice.amount_paid?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span>
                            </div>
                            <div className="flex justify-between py-1 bg-gray-100">
                                <span className="font-bold">Balance Due:</span>
                                <span className="font-bold text-lg">{invoice.balance?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-24 grid grid-cols-2 gap-8 text-xs">
                        <div>
                            <h5 className="font-bold mb-1">BANK DETAILS:</h5>
                            <p><strong>Bank Name:</strong> STATE BANK OF INDIA</p>
                            <p><strong>Branch:</strong> ELDAMS ROAD BRANCH ALWARPET</p>
                            <p><strong>A/C No:</strong> 42804313699</p>
                            <p><strong>IFSC:</strong> SBIN0002209</p>
                        </div>
                        <div className="text-center self-end pt-16">
                            <p className="font-bold border-t border-gray-500 pt-1">Authorized Signatory</p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default InvoiceForm;