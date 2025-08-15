import { graphData } from './data';
import { parseArrayData } from './utils';
import { newData } from './newData';
import { useEffect, useState } from 'react';
import ViewDefault from './defaultECG/viewDefault';
import ViewQRS from './QRS/viewQRS';
import ViewZC from './zeroCrossingQrs/viewZC';

function App() {
  const [currentView, setCurrentView] = useState(null);
  const [currentData, setCurrentData] = useState(null);
  const [series, setSeries] = useState(null);

  useEffect(() => {
    if (currentData === 0) {
      setSeries(parseArrayData(graphData));
    } else if(currentData===1) {
      setSeries(parseArrayData(newData));
    }
  }, [currentData]);

  const changeCurrentView = (id) => {
    currentView !== id && setCurrentView(id);
  };

  const changeCurrentData = (id) => {
    currentData !== id && setCurrentData(id);
  };

  const activeStyle = {
    background: 'black',
    color: 'white',
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          width: '80%',
        }}
      >
        <div>
          <button style={currentView === 0 ? activeStyle : {}} onClick={() => changeCurrentView(0)}>
            Стандартный вид (3 канала)
          </button>
          <button style={currentView === 1 ? activeStyle : {}} onClick={() => changeCurrentView(1)}>
            Алгоритм PT
          </button>
          <button style={currentView === 2 ? activeStyle : {}} onClick={() => changeCurrentView(2)}>
            Алгоритм KHO
          </button>
          <button style={currentView === 3 ? activeStyle : {}} onClick={() => changeCurrentView(3)}>
            Алгоритм KHO(2)
          </button>
        </div>
        <div>
          <button style={currentData === 0 ? activeStyle : {}} onClick={() => changeCurrentData(0)}>
            Файл 1
          </button>
          <button style={currentData === 1 ? activeStyle : {}} onClick={() => changeCurrentData(1)}>
            Файл 2
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'row' }}>
        {currentData === null || currentView === null ||series === null? (
          'Выберите файл для построения графиков'
        ) : currentView === 0 ? (
          <ViewDefault series={series} />
        ) : currentView === 1 ? (
          <ViewQRS series={series} />
        ) : currentView === 2 ? (
          <ViewZC series={series} variant={1} />
        ) : (
          <ViewZC series={series} variant={2} />
        )}
      </div>
    </div>
  );
}

export default App;
