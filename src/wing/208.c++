class MinStack {
public: 
    int v[30010]={0};
    int left=0,right=0;
    MinStack() {

    }
    
    void push(int value) {
        v[right]=value;
        right++;
    }
    
    void pop() {
        right--;
    }
    
    int top() {
       return v[right-1];
    }
    
    int getMin() {
        return v[left];
    }
};

/**
 * Your Minstack_v object will be instantiated and called as such:
 * Minstack_v* obj = new Minstack_v();
 * obj->push(value);
 * obj->pop();
 * int param_3 = obj->top();
 * int param_4 = obj->getMin();
 */