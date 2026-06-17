import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Writing from './pages/Writing';
import WhatLambdaWasHiding from './pages/posts/WhatLambdaWasHiding';
import CanaryingAPipeline from './pages/posts/CanaryingAPipeline';
import LanguageServer from './pages/posts/LanguageServer';
import TheModelNeverWritesTheSQL from './pages/posts/TheModelNeverWritesTheSQL';
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
          <Route path="writing/canarying-a-pipeline-you-cant-sample" element={<CanaryingAPipeline />} />
          <Route path="writing/what-its-like-to-work-on-a-language-server" element={<LanguageServer />} />
          <Route path="writing/the-model-never-writes-the-sql" element={<TheModelNeverWritesTheSQL />} />
          <Route path="open-source" element={<OpenSource />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
