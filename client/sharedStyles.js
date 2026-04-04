import { StyleSheet } from 'react-native';

export const THEME = {
  primary: '#0057D9',
  background: '#f5f6fa',
  card: '#ffffff',
  text: '#222222',
  subtext: '#888888',
  border: '#e6e6ee',
  success: '#00b386',
  danger: '#e53935',
};

const sharedStyles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e6e6ee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222222',
    marginBottom: 8,
  },
  subtext: {
    fontSize: 13,
    color: '#888888',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  button: {
    backgroundColor: '#0057D9',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
});

export default sharedStyles;