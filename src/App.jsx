import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Writing from './pages/Writing';
import WhatLambdaWasHiding from './pages/posts/WhatLambdaWasHiding';
import OpenSource from './pages/OpenSource';
import About from './pages/About';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<About />} />
          <Route path="writing" element={<Writing />} />
          <Route path="writing/what-lambda-was-hiding" element={<WhatLambdaWasHiding />} />
          <Route path="open-source" element={<OpenSource />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
