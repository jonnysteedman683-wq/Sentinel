const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Add import
content = content.replace(
  /import \{ PolicyConvergenceChart \} from "\.\/components\/PolicyConvergenceChart";/,
  `import { PolicyConvergenceChart } from "./components/PolicyConvergenceChart";\nimport { MemoryTab } from "./components/tabs/MemoryTab";`
);

// Replace block
const startIdx = content.indexOf("{activeTab === 'Memory' ? (");
if (startIdx !== -1) {
  const nextTabIdx = content.indexOf(") : activeTab === 'Brains' ? (", startIdx);
  if (nextTabIdx !== -1) {
    const memoryTabCall = `{activeTab === 'Memory' ? (
              <MemoryTab 
                memoryViewMode={memoryViewMode}
                setMemoryViewMode={setMemoryViewMode}
                isConsolidating={isConsolidating}
                memories={memories}
                handleManualConsolidate={handleManualConsolidate}
                memorySearchQuery={memorySearchQuery}
                setMemorySearchQuery={setMemorySearchQuery}
                selectedMemoryIds={selectedMemoryIds}
                handleSelectAllMemories={handleSelectAllMemories}
                handleClearMemorySelection={handleClearMemorySelection}
                handleBulkDelete={handleBulkDelete}
                isBulkDeleting={isBulkDeleting}
                handleBulkUpdateStrength={handleBulkUpdateStrength}
                isBulkReinforcing={isBulkReinforcing}
                isBulkDecaying={isBulkDecaying}
                isBulkTagging={isBulkTagging}
                bulkTagInput={bulkTagInput}
                setBulkTagInput={setBulkTagInput}
                handleBulkTag={handleBulkTag}
                selectedTagFilter={selectedTagFilter}
                setSelectedTagFilter={setSelectedTagFilter}
                allMemoryTags={allMemoryTags}
                filteredMemories={filteredMemories}
                handleSingleUpdateStrength={handleSingleUpdateStrength}
                togglePinMemory={togglePinMemory}
                removeMemory={removeMemory}
                theme={theme}
                setSelectedMemoryIds={setSelectedMemoryIds}
                setModelState={setModelState}
                fetchInsight={fetchInsight}
                setActiveInsight={setActiveInsight}
                startDateFilter={startDateFilter}
                setStartDateFilter={setStartDateFilter}
                endDateFilter={endDateFilter}
                setEndDateFilter={setEndDateFilter}
                handleAddMemory={handleAddMemory}
                newMemory={newMemory}
                setNewMemory={setNewMemory}
              />
            `;
    content = content.substring(0, startIdx) + memoryTabCall + content.substring(nextTabIdx);
    fs.writeFileSync('src/App.tsx', content);
    console.log("Successfully replaced MemoryTab block.");
  } else {
    console.log("Could not find Brains tab.");
  }
} else {
  console.log("Could not find Memory tab start.");
}
