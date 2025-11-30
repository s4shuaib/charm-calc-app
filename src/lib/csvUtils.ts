import Papa from 'papaparse';
import { format, parse } from 'date-fns';

export interface CSVRow {
  Date: string;
  Time: string;
  Remark?: string;
  'Entry by'?: string;
  Mode?: string;
  'Cash In'?: string;
  'Cash Out'?: string;
  Balance?: string;
  Type?: string;
  Category?: string;
  'Image URLs'?: string;
}

export interface ParsedEntry {
  amount: number;
  type: 'cash_in' | 'cash_out';
  remark: string;
  payment_mode: string;
  category: string;
  entry_date: string;
  entry_time: string;
}

export const parseCSVToEntries = (csvContent: string): ParsedEntry[] => {
  const results = Papa.parse<CSVRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  if (results.errors.length > 0) {
    console.error('CSV parsing errors:', results.errors);
    throw new Error('Failed to parse CSV file');
  }

  return results.data.map((row, index) => {
    try {
      // Parse date (DD MMM YYYY or DD MMMM YYYY)
      const dateStr = row.Date?.trim();
      if (!dateStr) throw new Error(`Row ${index + 1}: Missing date`);
      
      const parsedDate = parse(dateStr, 'dd MMMM yyyy', new Date());
      const entryDate = format(parsedDate, 'yyyy-MM-dd');

      // Parse time (hh:mm AM/PM)
      const timeStr = row.Time?.trim();
      if (!timeStr) throw new Error(`Row ${index + 1}: Missing time`);
      
      const parsedTime = parse(timeStr, 'h:mm a', new Date());
      const entryTime = format(parsedTime, 'HH:mm:ss');

      // Determine type and amount
      const cashIn = row['Cash In']?.trim();
      const cashOut = row['Cash Out']?.trim();
      
      let type: 'cash_in' | 'cash_out';
      let amount: number;

      if (cashIn && cashIn !== '') {
        type = 'cash_in';
        amount = parseFloat(cashIn.replace(/,/g, ''));
      } else if (cashOut && cashOut !== '') {
        type = 'cash_out';
        amount = parseFloat(cashOut.replace(/,/g, ''));
      } else {
        throw new Error(`Row ${index + 1}: Must have either Cash In or Cash Out`);
      }

      if (isNaN(amount) || amount < 0) {
        throw new Error(`Row ${index + 1}: Invalid amount`);
      }

      // Get other fields
      const remark = row.Remark?.trim() || '';
      const paymentMode = row.Mode?.trim() || 'Cash';
      const category = row.Category?.trim() || 'Uncategorized';

      return {
        amount,
        type,
        remark,
        payment_mode: paymentMode,
        category,
        entry_date: entryDate,
        entry_time: entryTime,
      };
    } catch (error: any) {
      throw new Error(`Row ${index + 1}: ${error.message}`);
    }
  });
};

export const exportEntriesToCSV = (entries: any[]): string => {
  const csvData: CSVRow[] = entries.map((entry) => {
    const date = parse(entry.entry_date, 'yyyy-MM-dd', new Date());
    const time = parse(entry.entry_time, 'HH:mm:ss', new Date());

    // Collect all image URLs from attachments
    const imageUrls: string[] = [];
    if (entry.attachments && Array.isArray(entry.attachments)) {
      entry.attachments.forEach((att: any) => {
        if (att.url) imageUrls.push(att.url);
      });
    }

    return {
      Date: format(date, 'dd MMMM yyyy'),
      Time: format(time, 'h:mm a'),
      Remark: entry.remark || '',
      'Entry by': 'You',
      Mode: entry.payment_mode || 'Cash',
      'Cash In': entry.type === 'cash_in' ? entry.amount.toString() : '',
      'Cash Out': entry.type === 'cash_out' ? entry.amount.toString() : '',
      Balance: '',
      Type: entry.type,
      Category: entry.category || 'Uncategorized',
      'Image URLs': imageUrls.join(' | '),
    };
  });

  const csv = Papa.unparse(csvData, {
    quotes: true,
    header: true,
  });

  return csv;
};

export const downloadCSV = (csvContent: string, filename: string) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
