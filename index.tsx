// Importa a função que regista o componente raiz da aplicação Expo
import { registerRootComponent } from 'expo';

// Importa o componente principal da aplicação
import App from './App';

// registerRootComponent regista o componente "App" como ponto de entrada da aplicação.
// Chama internamente AppRegistry.registerComponent('main', () => App).
// Garante que o ambiente está configurado correctamente tanto no Expo Go como em builds nativas.
registerRootComponent(App);
