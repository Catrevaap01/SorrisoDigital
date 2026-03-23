import { AppRegistry } from 'react-native';
import App from '../App';

// Register the app
AppRegistry.registerComponent('main', () => App);

// Run the app on web
AppRegistry.runApplication('main', {
  initialProps: {},
  rootTag: document.getElementById('root'),
});
