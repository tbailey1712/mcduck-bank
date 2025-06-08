import { Grid, Card, CardContent, Typography, Box, Container } from '@mui/material';
import { 
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination
} from '@mui/material';
import { useState } from 'react';
import SimpleUserProfileCard from '../components/SimpleUserProfileCard';
import SimpleWithdrawalForm from '../components/SimpleWithdrawalForm';

const summaryData = [
  { label: 'Current Balance', value: '$326.50' },
  { label: 'Pending Withdrawal', value: '$25.00' },
  { label: 'Interest This Month', value: '$1.43' },
];

const transactionRows = [
  { date: '2024-06-01', description: 'Interest', amount: '+$1.43' },
  { date: '2024-05-28', description: 'Withdrawal', amount: '-$25.00' },
  { date: '2024-05-15', description: 'Deposit', amount: '+$100.00' },
  { date: '2024-05-10', description: 'Allowance', amount: '+$10.00' },
  { date: '2024-05-05', description: 'Interest', amount: '+$1.25' },
];

function TransactionTable() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  return (
    <Paper sx={{ bgcolor: 'background.paper', mt: 4 }}>
      <Typography variant="h6" sx={{ px: 2, pt: 2 }}>Transaction History</Typography>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right">Amount</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {transactionRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, index) => (
              <TableRow key={index}>
                <TableCell>{row.date}</TableCell>
                <TableCell>{row.description}</TableCell>
                <TableCell align="right" sx={{ 
                  color: row.amount.startsWith('+') ? 'success.main' : 'error.main',
                  fontWeight: 600
                }}>
                  {row.amount}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={transactionRows.length}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        sx={{ px: 2 }}
      />
    </Paper>
  );
}

export default function DemoDashboard() {
  const handleWithdrawal = (data) => {
    console.log('Withdrawal requested:', data);
    alert(`Withdrawal requested: $${data.amount} - ${data.reason}`);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: { xs: 10, sm: 8, md: 9 }, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 4 }}>
        McDuck Bank - Demo Dashboard
      </Typography>
      
      {/* User Profile */}
      <SimpleUserProfileCard />
      
      {/* Account Summary Cards */}
      <Box sx={{ padding: 3 }}>
        <Grid container spacing={3}>
          {summaryData.map((item, idx) => (
            <Grid item xs={12} sm={4} key={idx}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    {item.label}
                  </Typography>
                  <Typography variant="h5" color="text.primary" sx={{ mt: 1 }}>
                    {item.value}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Transaction History */}
      <TransactionTable />
      
      {/* Withdrawal Form */}
      <SimpleWithdrawalForm onSubmit={handleWithdrawal} />
    </Container>
  );
}