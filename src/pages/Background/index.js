import debounce from 'lodash.debounce';
import { localStorage, syncStorage } from './storageManager';

const tabColors = [
  'grey',
  'yellow',
  'blue',
  'purple',
  'green',
  'red',
  'pink',
  'cyan',
  'orange',
];

let collapsed = false;

/**
 * すべてのウィンドウキーをクリアするよ！🧹
 */
const clearAllWindowKeys = () => {
  syncStorage.removeAll('window:');
  localStorage.removeAll('window:');
};

/**
 * 短いルールにマッチするかチェックする関数だよ！🔍
 * @param {string} rule - チェックするルールだよ
 * @returns {RegExp} - 生成された正規表現
 */
function matchRuleShort(rule) {
  var escapeRegex = (str) => str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1');
  return new RegExp(rule.split('*').map(escapeRegex).join('.*'));
}

/**
 * グループルールを取得するよ！📚
 * @returns {Promise<Array>} - ソートされたグループルールの配列
 */
const getGroupRules = async () => {
  const groupRules = await syncStorage.get('groupRules');
  return groupRules ? groupRules.sort((a, b) => a.key - b.key) : [];
};

/**
 * 現在のウィンドウを取得するよ！🏠
 * @returns {Promise<Object>} - 現在のウィンドウオブジェクト
 */
const getCurrentWindow = async () => {
  const window = await chrome.windows.getCurrent();
  return window;
};

/**
 * タブグループに対するルールを取得するよ！📏
 * @param {number} tabGroupId - タブグループのID
 * @returns {Promise<Object|null>} - ルールオブジェクト、またはnull
 */
const getRuleForTabGroup = async (tabGroupId) => {
  const windowGroupEntries = await localStorage.getAll(
    `window:.*:rule:.*:groupId`
  );
  const match = windowGroupEntries.find(([k, v]) => v === tabGroupId);
  if (match) {
    const [k, v] = match;
    const ruleId = k
      .replace(new RegExp('window:.*:rule:'), '')
      .replace(':groupId', '');
    const groupRules = await getGroupRules();
    return groupRules.find((r) => r.id.toString() === ruleId);
  }
  return null;
};

/**
 * 特定のウィンドウIDに対するアシッドタブグループを取得するよ！🧪
 * @param {number|null} windowId - ウィンドウID、指定しない場合はnull
 * @returns {Promise<Array>} - タブグループIDの配列
 */
const getAcidTabGroups = async (windowId = null) => {
  const pattern = windowId
    ? `window:${windowId}:rule:.*:groupId`
    : `window:.*:rule:.*:groupId`;
  const windowGroupEntries = await localStorage.getAll(pattern);
  return windowGroupEntries.map(([k, v]) => v) || [];
};

/**
 * IDに基づいてタブグループを取得するよ！🔍
 * @param {number} id - タブグループのID
 * @returns {Promise<Object>} - タブグループオブジェクト
 */
const getTabGroup = async (id) =>
  new Promise((resolve) => chrome.tabGroups.get(id, resolve));

/**
 * タブグループを更新するよ！🔄
 * @param {Object} args - 更新する引数（collapsedなど）
 */
const updateTabGroups = async (args = {}) => {
  if (chrome.tabGroups) {
    if (args.collapsed !== undefined) {
      collapsed = args.collapsed;
    }
    const tabGroups = await getAcidTabGroups();
    for (const tabGroupId of tabGroups) {
      try {
        const group = await getTabGroup(tabGroupId);
        if (!group) {
          console.log('no group');
          continue;
        }
        chrome.tabGroups.update(tabGroupId, args);
        const rule = await getRuleForTabGroup(tabGroupId);
        if (rule) updateTabGroupForRule(group.windowId, group.id, rule);
      } catch (e) {
        console.error(e.stack);
      }
    }
  }
};

/**
 * ルールに一致しないタブをグループからキックアウトするよ！🚀
 */
const kickoutNonMatchingTabs = async () => {
  const window = await getCurrentWindow();
  const tabGroups = await getAcidTabGroups();
  const rules = await getGroupRules();
  const allTabs = await chrome.tabs.query({ windowId: window.id });
  for (const tabGroupId of tabGroups) {
    const tabsInGroup = allTabs.filter((t) => t.groupId === tabGroupId);
    for (const tab of tabsInGroup) {
      const rule = checkForRuleMatch(tab.url, rules) || null;
      if (!rule) await chrome.tabs.ungroup(tab.id);
    }
  }
};

/**
 * ルールに基づいてタブの色を取得するよ！🌈
 * @param {Object} rule - ルールオブジェクト
 * @param {Array} rules - ルールの配列
 * @returns {string} - タブの色
 */
const getColorForRule = (rule, rules) => {
  if (rule.color) return rule.color;
  const index = rules.findIndex((r) => r.id === rule.id);
  const color = tabColors[index % tabColors.length];
  return color;
};

/**
 * ルールに基づいてグループIDを取得するよ！🆔
 * @param {number} windowId - ウィンドウID
 * @param {Object} rule - ルールオブジェクト
 * @returns {Promise<number>} - グループID
 */
const getGroupIdForRule = async (windowId, rule) => {
  const key = `window:${windowId}:rule:${rule.id}:groupId`;
  const ruleId = await localStorage.get(key);
  return ruleId;
};

/**
 * ルールに基づいてグループIDを設定するよ！📝
 * @param {Object} rule - ルールオブジェクト
 * @param {number} windowId - ウィンドウID
 * @param {number} groupId - グループID
 */
const setGroupIdForRule = async (rule, windowId, groupId) => {
  const key = `window:${windowId}:rule:${rule.id}:groupId`;
  await localStorage.set(key, groupId);
};

/**
 * アクティブなグループIDを取得するよ！🔍
 * @param {number} windowId - ウィンドウID
 * @returns {Promise<Array>} - アクティブなグループIDの配列
 */
const getActiveGroupIds = async (windowId) => {
  const rules = await getGroupRules();
  const groupIds = await Promise.all(
    rules.map((r) => getGroupIdForRule(windowId, r))
  );
  return groupIds.filter((gId) => !!gId) || [];
};

/**
 * すべてのタブ📑をそのウィンドウ🏠で割り当てるよ！
 * 完了したタブをクエリして、現在のウィンドウを取得した後、
 * それぞれのタブに対して処理を行い、最後にタブを整列させるんだ。
 */
const assignAllTabsInWindow = async () => {
  const tabs = await chrome.tabs.query({ status: 'complete' });
  const window = await getCurrentWindow();
  for (const tab of tabs) {
    await handleTab(tab.id);
  }
  alignTabs(window.id);
};

/**
 * URLがルール📏にマッチするかチェックするよ！
 * ルールのパターンを改行とスペースで分割して、URLがパターンにマッチするかどうかを確認するんだ。
 * マッチしたルールがあればそれを返すよ。
 *
 * @param {string} url - チェックするURL🔗だよ。
 * @param {Array} rules - チェックするルールの配列📜だよ。
 * @returns {Object|null} マッチしたルール、なければnullを返すよ。
 */
const checkForRuleMatch = (url, rules) => {
  for (const rule of rules) {
    const lineSplit = rule.pattern.split('\n');
    const patterns = lineSplit
      .reduce((prev, cur) => prev.concat(cur.split(' ')), [])
      .filter((p) => p.length)
      .map((p) => matchRuleShort(p.trim()));
    for (const pattern of patterns) {
      if (url.match(pattern)) return rule;
    }
  }
  return null;
};

/**
 * 古いウィンドウエントリ🏠をクリアするよ！
 * localStorageから古いウィンドウエントリを取得して、
 * 現在開いているウィンドウに存在しないものを削除するんだ。
 */
const clearOldWindowEntries = async () => {
  const allWindowEntries = await localStorage.getAll('window:.*:tabGroups');
  const windows = await chrome.windows.getAll();
  const oldWindowEntries = allWindowEntries.filter(
    ([k, v]) => !windows.some((w) => k.includes(`window:${w.id}:tabGroups`))
  );

  const oldKeys = oldWindowEntries.map(([k, _]) => k);
  await localStorage.remove(oldKeys);
};

/**
 * 古いエントリ🗑をクリアするよ！
 * localStorageから古いルールグループエントリを取得して、
 * 現在のルールに存在しないものを削除するんだ。
 * それに、古いグループIDに属するタブがあれば、それらをグループから外すよ。
 */
const clearOldEntries = async () => {
  const allRuleGroupEntries = await localStorage.getAll(
    'window:.*:rule:.*:groupId'
  );
  const rules = await getGroupRules();
  const oldRuleGroupEntries = allRuleGroupEntries.filter(
    ([k, v]) => !rules.some((r) => k.includes(`rule:${r.id}:groupId`))
  );

  for (const [k, groupId] of oldRuleGroupEntries) {
    const tabs = await new Promise((resolve) => chrome.tabs.query({}, resolve));
    const tabsStillInGroup = tabs.filter((t) => t.groupId === groupId);
    for (const tab of tabsStillInGroup) {
      await new Promise((resolve) => chrome.tabs.ungroup(tab.id, resolve));
    }
  }
  const oldKeys = oldRuleGroupEntries.map(([k, _]) => k);
  await localStorage.remove(oldKeys);
};

/**
 * ルール📏に基づいてタブグループ🗂を更新するよ！
 * グループIDとルールに基づいて、タブグループのタイトルと色を更新するんだ。
 *
 * @param {number} windowId - ウィンドウID🏠だよ。
 * @param {number} groupId - グループID🆔だよ。
 * @param {Object} rule - ルールオブジェクト📏だよ。
 */
const updateTabGroupForRule = async (windowId, groupId, rule) => {
  if (chrome.tabGroups) {
    const rules = await getGroupRules();
    const color = getColorForRule(rule, rules);
    const group = await getTabGroup(groupId);
    if (!group) return;

    const tabs = await new Promise((resolve) =>
      chrome.tabs.query({ windowId }, resolve)
    );
    const tabsInGroup = tabs.filter((t) => t.groupId === groupId);
    const title =
      group.collapsed && tabsInGroup.length
        ? `${rule.name} (${tabsInGroup.length})`
        : rule.name;
    chrome.tabGroups.update(groupId, { title, color });
  }
};

/**
 * タブグループ🗂を取得または作成するよ！
 * 既存のグループIDがあればそれを使って、なければ新しいグループを作成するんだ。
 *
 * @param {number} windowId - ウィンドウID🏠だよ。
 * @param {number} tabId - タブID📑だよ。
 * @param {number} existingGroupId - 既存のグループID🆔だよ。
 * @returns {Promise<number>} グループID🆔を返すよ。
 */
const getOrCreateTabGroup = async (windowId, tabId, existingGroupId) => {
  const createProperties = existingGroupId ? undefined : { windowId };
  let groupId;
  try {
    groupId = await chrome.tabs.group({
      tabIds: tabId,
      groupId: existingGroupId,
      createProperties,
    });
  } catch (e) {
    const isNoGroupError = e.message.startsWith('No group with id');
    if (isNoGroupError) {
      const createProperties = { windowId };
      groupId = await chrome.tabs.group({ tabIds: tabId, createProperties });
      return groupId;
    }

    throw e;
  }

  return groupId;
};

/**
 * タブ📑を整列させるよ！
 * タブグループ🗂をルール📏に基づいて順番に並べ替えるんだ。
 * ピン留めされたタブはそのままにして、残りのタブをルールに従って移動させるよ。
 *
 * @param {number} windowId - ウィンドウID🏠だよ。
 */
const alignTabs = async (windowId) => {
  if (chrome.tabGroups) {
    const rules = await getGroupRules();
    const orderedRules = rules.sort((a, b) => a.key - b.key);
    const currentTabGroups = await new Promise((resolve) =>
      chrome.tabGroups.query({ windowId }, resolve)
    );
    const tabs = await new Promise((resolve) =>
      chrome.tabs.query({ windowId }, resolve)
    );
    let offset = tabs.filter((t) => t.pinned).length;
    for (const r of orderedRules) {
      const groupId = await getGroupIdForRule(windowId, r);
      const tabsInGroup = tabs.filter((t) => t.groupId === groupId);
      if (currentTabGroups.some((g) => g.id === groupId)) {
        chrome.tabGroups.move(groupId, { index: offset }, () => {
          if (chrome.runtime.lastError) {
            console.log(chrome.runtime.lastError.message);
          }
        });

        offset = offset + tabsInGroup.length;
      }
    }
  }
};
/**
 * タブ📑を処理し、適切なタブグループ🗂に割り当てる関数です。
 * タブが特定のルール📏に一致する場合、そのルールに基づいてタブグループを作成または更新します。
 * タブがドラッグ中にエラーが発生した場合、指定された回数だけリトライします。
 *
 * @param {number} tabId - 処理するタブのID🆔です。
 * @param {number} retryCount - ユーザーによるタブのドラッグ操作中にエラーが発生した場合のリトライ回数です。デフォルトは3回です。
 * @returns {Promise<void>} 処理が完了したら解決するプロミスです。
 */
const handleTab = async (tabId, retryCount = 3) => {
  try {
    const tab = await chrome.tabs.get(tabId); // タブの情報を取得します。
    const windowId = tab.windowId; // タブが属するウィンドウのIDを取得します。
    const rules = await getGroupRules(); // グループ化のルールを取得します。
    const rule = checkForRuleMatch(tab.url, rules) || null; // タブのURLがルールに一致するか確認します。
    if (rule && !tab.pinned) {
      // タブがルールに一致し、ピン留めされていない場合
      const existingGroupId = await getGroupIdForRule(windowId, rule); // 既存のグループIDを取得します。
      const groupId = await getOrCreateTabGroup(
        windowId,
        tabId,
        existingGroupId
      ); // タブグループを取得または作成するよ！

      updateTabGroupForRule(windowId, groupId, rule); // タブグループを更新するよ！
      if (existingGroupId !== groupId) {
        // 新しいグループIDが既存のものと異なる場合
        await setGroupIdForRule(rule, windowId, groupId); // 新しいグループIDを設定するよ！
      }
    } else {
      // タブがルールに一致しない場合
      const tabGroups = await getAcidTabGroups(); // タブグループを取得するよ！
      const inAcidTabGroup = tabGroups.includes(tab.groupId); // タブが特定のタブグループに含まれているか確認するよ！
      if (inAcidTabGroup) await chrome.tabs.ungroup(tab.id); // タブをグループから外すよ！
    }
  } catch (e) {
    // タブがドラッグ中にエラーが発生した場合の追加のリトライロジックだよ！
    const isTabMoveError =
      e.message ==
      'Tabs cannot be edited right now (user may be dragging a tab).'; // エラーメッセージを確認するよ！
    if (isTabMoveError && retryCount > 0) {
      // エラーがタブの移動に関連しており、リトライ回数が残っている場合
      const delay = 250 * retryCount; // リトライの遅延時間を計算するよ！
      await new Promise((res) => setTimeout(res, delay)); // 指定された時間だけ待機するよ！
      return handleTab(tabId, retryCount - 1); // リトライするよ！
    }

    console.error(e.stack); // エラーをコンソールに出力するよ！
  }
};

chrome.webNavigation.onCommitted.addListener(async ({ tabId, url }) => {
  // タブがコミットされたら、このタブを処理するんだ🚀
  handleTab(tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  // タブが更新されたら、URLが変わったかグループが解除されたかチェックするんだ🔍
  if (changeInfo.url || changeInfo.groupId == -1) {
    handleTab(tabId);
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  // タブがアクティブになったら、ちょっと多めにリトライしてみるよ🔄
  // ユーザーがまだドラッグしてる可能性が高いからね🐭
  handleTab(tabId, 5);
});

chrome.runtime.onStartup.addListener(() => {
  // 拡張機能が起動したら、古いウィンドウキーを全部消すぞ🧹
  clearAllWindowKeys();
});

// 既存の全タブをスキャンして、適切なグループに割り当てるんだ🔎
try {
  assignAllTabsInWindow();
  kickoutNonMatchingTabs();
} catch (e) {
  // 何か問題があったら、エラーをコンソールに出力するよ🚨
  console.error(e.stack);
}

chrome.action.onClicked.addListener((tab) => {
  // アクションボタンがクリックされたら、タブを再割り当てするんだ🔄
  assignAllTabsInWindow();
  kickoutNonMatchingTabs();
});

chrome.commands.onCommand.addListener((command) => {
  // コマンドが実行されたら、特定のコマンドに応じてタブグループを更新するんだ🛠
  if (command === 'toggle-collapse') {
    updateTabGroups({ collapsed: !collapsed });
  }
});

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  // メッセージが送られてきたら、内容に応じて処理するんだ📬
  try {
    if (request.updated) {
      // 更新が必要なら、ルールに合わないタブをキックアウトして、古いエントリをクリアするんだ🧹
      await kickoutNonMatchingTabs();
      await clearOldEntries();
      await clearOldWindowEntries();
      assignAllTabsInWindow();
    } else if (request.collapse) {
      // グループを折りたたむ指示があれば、そうするんだ🔽
      updateTabGroups({ collapsed: true });
    } else if (request.expand) {
      // グループを展開する指示があれば、そうするんだ🔼
      updateTabGroups({ collapsed: false });
    }
  } catch (e) {
    // 何か問題があったら、エラーをコンソールに出力するよ🚨
    console.error(e.stack);
  }
});

/**
 * タブグループが更新されたときの処理だよ！🔄
 * @param {Object} tabGroup - 更新されたタブグループ
 */
const handleTabGroupUpdate = async (tabGroup) => {
  // タブグループが更新されたら、タブを整列させて、ルールに基づいてグループを更新するんだ🛠
  alignTabs(tabGroup.windowId);
  const rules = await getGroupRules();
  for (const r of rules) {
    const gId = await getGroupIdForRule(tabGroup.windowId, r);
    if (gId === tabGroup.id) {
      updateTabGroupForRule(tabGroup.windowId, tabGroup.id, r);
      return;
    }
  }
};

if (chrome.tabGroups) {
  // タブグループがサポートされているブラウザで、タブグループが更新されたら処理するんだ👍
  chrome.tabGroups.onUpdated.addListener(
    debounce(handleTabGroupUpdate, 100, { leading: true, trailing: false })
  );
}
