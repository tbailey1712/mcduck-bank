import { Card, CardContent, Typography, Avatar, Stack } from '@mui/material';
import { useUnifiedAuth } from '../contexts/UnifiedAuthProvider';

export default function SimpleUserProfileCard() {
  const { user } = useUnifiedAuth();
  
  return (
    <Card sx={{ maxWidth: 400, mx: 'auto', mt: 4 }}>
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar 
            src={user?.photoURL || "/user.jpg"} 
            sx={{ width: 64, height: 64 }} 
          />
          <div>
            <Typography variant="h6">
              {user?.displayName || 'Alex McDuck'}
            </Typography>
            <Typography color="text.secondary">Child Account</Typography>
          </div>
        </Stack>
      </CardContent>
    </Card>
  );
}